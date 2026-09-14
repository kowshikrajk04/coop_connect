"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Search, Zap, Droplet, Hammer, Paintbrush, Home, Heart, 
  Car, Flower2, Sparkles, Cpu, AlertTriangle, Calendar, 
  Clock, MapPin, CheckCircle2, ArrowRight, ShieldCheck, 
  X, CreditCard, Star, FileText, ChevronRight
} from "lucide-react";
import { api, getUserRole } from "@/lib/api";

const SERVICES = [
  { id: "Electrician", name: "Electrician", icon: Zap, price: 450, desc: "Switches, wiring, MCB & appliances" },
  { id: "Plumber", name: "Plumber", icon: Droplet, price: 450, desc: "Leaks, pipes, faucets & fittings" },
  { id: "Carpenter", name: "Carpenter", icon: Hammer, price: 500, desc: "Doors, furniture & woodwork" },
  { id: "Painter", name: "Painter", icon: Paintbrush, price: 600, desc: "Wall painting & waterproofing" },
  { id: "Domestic Helper", name: "Domestic Helper", icon: Home, price: 400, desc: "Cleaning, dishes & home upkeep" },
  { id: "Caregiver", name: "Caregiver", icon: Heart, price: 700, desc: "Elderly & patient assistance" },
  { id: "Driver", name: "Driver", icon: Car, price: 600, desc: "Personal & highway driving" },
  { id: "Gardener", name: "Gardener", icon: Flower2, price: 450, desc: "Lawn care, pruning & potting" },
  { id: "Cleaner", name: "Cleaner", icon: Sparkles, price: 400, desc: "Deep bathroom & floor scrub" },
  { id: "Technician", name: "Technician", icon: Cpu, price: 550, desc: "AC repair & electronics service" },
];

export default function CustomerDashboard() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [previousBookings, setPreviousBookings] = useState<any[]>([]);
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);

  // Booking Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<string>("Electrician");
  const [workDesc, setWorkDesc] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("Morning (8:00 AM - 12:00 PM)");
  const [serviceLocation, setServiceLocation] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState("");
  const [servicePhotoUrl, setServicePhotoUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<any>(null);

  useEffect(() => {
    // Set default date to today
    const today = new Date().toISOString().split("T")[0];
    setBookingDate(today);

    // Fetch profile and bookings
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoadingBookings(true);
    try {
      const prof = await api.customer.getProfile().catch(() => null);
      if (prof) {
        setCustomerProfile(prof);
        setServiceLocation(prof.address || "");
      }

      const res = await api.customer.getBookings();
      setActiveBookings(res.active || []);
      setPreviousBookings(res.previous || []);
    } catch (e) {
      // If unauthorized, redirect to login
      if (getUserRole() !== "CUSTOMER") {
        router.push("/login");
      }
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const handleOpenBooking = (serviceName: string) => {
    setSelectedService(serviceName);
    setIsEmergency(false);
    setEmergencyReason("");
    setWorkDesc("");
    setBookingSuccessMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEmergency && !emergencyReason) {
      alert("Please specify the emergency reason according to safety guidelines.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.bookings.create({
        service_type: selectedService,
        description: workDesc,
        is_emergency: isEmergency,
        emergency_reason: isEmergency ? emergencyReason : null,
        scheduled_date: bookingDate,
        scheduled_time: bookingTime,
        customer_address: serviceLocation || (customerProfile?.address ?? "City Centre"),
        service_photo_url: servicePhotoUrl || null,
      });

      setBookingSuccessMsg(res);
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || "Failed to create booking.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredServices = SERVICES.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Welcome Banner */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">
            Customer Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            Welcome back, {customerProfile?.full_name || "Valued Customer"}
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Book verified cooperative workers backed by fair AI allocation and guaranteed service quality.
          </p>
        </div>

        <button
          onClick={() => handleOpenBooking("Electrician")}
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition flex items-center gap-2 flex-shrink-0"
        >
          <span>Book a Service</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Search Service Bar */}
      <div className="relative max-w-2xl">
        <Search className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for a service (e.g. Electrician, Tap leakage, Wall paint, Cleaner)..."
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-2xs"
        />
      </div>

      {/* Popular Service Categories */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Service Categories</h2>
          <span className="text-xs text-gray-500">10 Verified Cooperative Trades</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {filteredServices.map((srv) => {
            const Icon = srv.icon;
            return (
              <div
                key={srv.id}
                onClick={() => handleOpenBooking(srv.name)}
                className="group cursor-pointer bg-white border border-gray-200 hover:border-blue-500 rounded-xl p-5 transition shadow-2xs hover:shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base">{srv.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">{srv.desc}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-900">₹{srv.price}</span>
                  <span className="font-semibold text-blue-600 group-hover:underline">Book →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Bookings Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Active Bookings</h2>
          <Link href="/customer/bookings" className="text-xs font-semibold text-blue-600 hover:underline">
            View All Bookings
          </Link>
        </div>

        {isLoadingBookings ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading bookings...</div>
        ) : activeBookings.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No bookings yet</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mt-1 mb-6">
              You do not have any active service requests right now. Book a trusted cooperative worker for your home or office.
            </p>
            <button
              onClick={() => handleOpenBooking("Electrician")}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition inline-flex items-center gap-2"
            >
              <span>Book a Service</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Active Booking Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeBookings.map((b) => (
              <div key={b.id} className="bg-white border-2 border-blue-100 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-mono text-gray-400 block">#{b.booking_number}</span>
                    <h3 className="text-lg font-bold text-gray-900">{b.service_type}</h3>
                    {b.is_emergency && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 mt-1">
                        <AlertTriangle className="w-3 h-3" />
                        EMERGENCY ({b.emergency_priority})
                      </span>
                    )}
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {b.status}
                  </span>
                </div>

                <p className="text-xs text-gray-600 line-clamp-2">{b.description}</p>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>{b.scheduled_date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span>{b.scheduled_time}</span>
                  </div>
                </div>

                {b.worker && (
                  <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Assigned Worker</span>
                      <p className="font-semibold text-gray-900">{b.worker.name}</p>
                      <span className="text-gray-500">📞 +91 {b.worker.mobile}</span>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center gap-0.5 font-bold text-amber-600">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        {b.worker.rating}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-bold text-gray-900">Total: ₹{b.total_amount}</span>
                  <Link
                    href={`/customer/bookings`}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <span>Track Booking</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOOKING MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-xl relative my-8">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            {bookingSuccessMsg ? (
              /* Success confirmation view */
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Service Request Registered</h3>
                <p className="text-sm text-gray-600 max-w-md mx-auto">
                  Booking <strong>#{bookingSuccessMsg.booking_number}</strong> has been submitted.
                </p>

                {bookingSuccessMsg.allocated_worker ? (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-left text-xs space-y-2">
                    <div className="flex items-center justify-between font-bold text-blue-900">
                      <span>Fairness-Aware Worker Matched!</span>
                      <span className="text-emerald-700">★ Verified Member</span>
                    </div>
                    <p className="text-gray-700">
                      <strong>Worker:</strong> {bookingSuccessMsg.allocated_worker.name} (📞 +91 {bookingSuccessMsg.allocated_worker.mobile})
                    </p>
                    <p className="text-gray-600">
                      <strong>Proximity:</strong> ~{bookingSuccessMsg.allocated_worker.distance_km} km away
                    </p>
                    {bookingSuccessMsg.allocation_metrics && (
                      <div className="pt-2 border-t border-blue-200/60 text-[11px] text-gray-500">
                        Suitability Score: <strong>{bookingSuccessMsg.allocation_metrics.suitability_score}/100</strong> • Opportunity Need: <strong>{bookingSuccessMsg.allocation_metrics.opportunity_gap}</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-xl text-xs text-gray-600">
                    {bookingSuccessMsg.message}
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      router.push("/customer/bookings");
                    }}
                    className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition"
                  >
                    Go to My Bookings
                  </button>
                </div>
              </div>
            ) : (
              /* Booking Form */
              <form onSubmit={handleSubmitBooking} className="space-y-4">
                <div className="pb-3 border-b border-gray-100">
                  <h3 className="text-xl font-bold text-gray-900">Book a Service</h3>
                  <p className="text-xs text-gray-500">Transparent cooperative rates • Verified workers</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Service Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {SERVICES.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} (Base ₹{s.price})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Description of Work <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={workDesc}
                    onChange={(e) => setWorkDesc(e.target.value)}
                    placeholder="Describe the issue or requirements (e.g. Master bedroom switchboard sparkling when turned on)..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Preferred Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Preferred Time Slot <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
                    >
                      <option value="Morning (8:00 AM - 12:00 PM)">Morning (8:00 AM - 12:00 PM)</option>
                      <option value="Afternoon (12:00 PM - 4:00 PM)">Afternoon (12:00 PM - 4:00 PM)</option>
                      <option value="Evening (4:00 PM - 8:00 PM)">Evening (4:00 PM - 8:00 PM)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Service Address / Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={serviceLocation}
                    onChange={(e) => setServiceLocation(e.target.value)}
                    placeholder="Flat / House No., Apartment, Street, City"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Upload Photo (Optional)
                  </label>
                  <input
                    type="text"
                    value={servicePhotoUrl}
                    onChange={(e) => setServicePhotoUrl(e.target.value)}
                    placeholder="Optional photo link showing issue"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs"
                  />
                </div>

                {/* EMERGENCY TOGGLE WITH STRICT POLICY */}
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-bold text-gray-900">Mark as Emergency Service?</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isEmergency}
                        onChange={(e) => setIsEmergency(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                  </div>

                  {isEmergency && (
                    <div className="space-y-2 pt-2 border-t border-amber-200/60">
                      <p className="text-[11px] text-amber-900 font-medium">
                        Emergency requests are reviewed based on priority rules (safety risk, water leakage, electrical hazard, major property damage, immediate essential service).
                      </p>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                          Emergency Reason <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={emergencyReason}
                          onChange={(e) => setEmergencyReason(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-amber-300 text-xs bg-white"
                        >
                          <option value="">Select verified emergency reason...</option>
                          <option value="Electrical hazard with sparks or risk of fire">Electrical hazard with sparks or risk of fire</option>
                          <option value="Severe water pipe burst with active flooding">Severe water pipe burst with active flooding</option>
                          <option value="Sewage line backflow or gas leak danger">Sewage line backflow or gas leak danger</option>
                          <option value="Broken lock or door security breach">Broken lock or door security breach</option>
                          <option value="Urgent medical assistance / elderly care emergency">Urgent medical assistance / elderly care emergency</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-1/3 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-2/3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition"
                  >
                    {isSubmitting ? "Allocating Worker..." : "Confirm & Allocate Worker"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
