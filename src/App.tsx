import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  AlertCircle, 
  ChevronRight, 
  ClipboardList, 
  Database, 
  Heart, 
  Home, 
  Layers, 
  LayoutDashboard, 
  LogOut, 
  Map as MapIcon, 
  Menu, 
  Plus, 
  Shield, 
  User, 
  X,
  Thermometer,
  Droplets,
  Stethoscope,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, Circle, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Fix Leaflet icon issue
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
type Role = 'citizen' | 'asha' | 'government';

interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  street_name?: string;
  house_number?: string;
  ward_no?: string;
  age?: number;
}

interface SymptomLog {
  id: number;
  symptoms: string;
  severity: number;
  latitude: number;
  longitude: number;
  problem_type: 'disease' | 'drainage' | 'other';
  status: 'active' | 'solved';
  predicted_disease?: string;
  risk_level?: string;
  created_at: string;
  full_name?: string;
  street_name?: string;
  house_number?: string;
  ward_no?: string;
  age?: number;
}

interface Alert {
  id: number;
  type: string;
  message: string;
  latitude: number;
  longitude: number;
  status: string;
}

// Components
const Button = ({ className, variant = 'primary', size = 'md', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'danger', size?: 'sm' | 'md' | 'lg' }) => {
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
    secondary: 'bg-slate-800 text-white hover:bg-slate-900',
    outline: 'border border-slate-200 text-slate-700 hover:bg-slate-50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button 
      className={cn('rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50', variants[variant], sizes[size], className)} 
      {...props} 
    />
  );
};

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-white rounded-2xl border border-slate-100 shadow-sm p-6', className)}>
    {children}
  </div>
);

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    className={cn('w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all', className)} 
    {...props} 
  />
);

const Badge = ({ children, variant = 'info' }: { children: React.ReactNode; variant?: 'info' | 'success' | 'warning' | 'danger' }) => {
  const variants = {
    info: 'bg-blue-50 text-blue-700 border-blue-100',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    danger: 'bg-rose-50 text-rose-700 border-rose-100',
  };
  return (
    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold border', variants[variant])}>
      {children}
    </span>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'dashboard' | 'map' | 'report' | 'alerts'>('report');
  const [isAuthOpen, setIsAuthOpen] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapData, setMapData] = useState<{ symptoms: SymptomLog[], alerts: Alert[] }>({ symptoms: [], alerts: [] });
  const [userStats, setUserStats] = useState<{ logs: SymptomLog[], vitals: any }>({ logs: [], vitals: null });

  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('citizen');
  const [streetName, setStreetName] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [wardNo, setWardNo] = useState('');
  const [age, setAge] = useState('');

  // Symptom Form State
  const [symptoms, setSymptoms] = useState('');
  const [severity, setSeverity] = useState(5);
  const [problemType, setProblemType] = useState<'disease' | 'drainage' | 'other'>('disease');
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);

  useEffect(() => {
    if (user) {
      fetchMapData();
      fetchUserStats();
    }
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  }, [user]);

  const fetchMapData = async () => {
    const res = await fetch('/api/map-data');
    const data = await res.json();
    setMapData(data);
  };

  const fetchUserStats = async () => {
    if (!user) return;
    const res = await fetch(`/api/user-stats/${user.id}`);
    const data = await res.json();
    setUserStats(data);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
    const body = authMode === 'login' 
      ? { email, password } 
      : { 
          email, 
          password, 
          fullName, 
          role: selectedRole, 
          streetName: selectedRole === 'citizen' ? streetName : null, 
          houseNumber: selectedRole === 'citizen' ? houseNumber : null, 
          wardNo: (selectedRole === 'citizen' || selectedRole === 'asha') ? wardNo : null, 
          age: selectedRole === 'citizen' ? parseInt(age) || null : null 
        };
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setIsAuthOpen(false);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSymptomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !location) return;
    setLoading(true);
    try {
      const res = await fetch('/api/symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          symptoms,
          severity,
          latitude: location.lat,
          longitude: location.lng,
          problemType,
        }),
      });
      if (res.ok) {
        setSymptoms('');
        setSeverity(5);
        fetchUserStats();
        fetchMapData();
        setView('dashboard');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSolveProblem = async (problemId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/problems/${problemId}/solve`, { method: 'POST' });
      if (res.ok) {
        fetchMapData();
        fetchUserStats();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (isAuthOpen) {
    if (!selectedRole) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-4xl"
          >
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-600 text-white mb-6 shadow-xl shadow-emerald-200">
                <Shield size={40} />
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">HealthGuard Portal</h1>
              <p className="text-slate-500 text-lg">Select your access level to continue</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <RoleCard 
                icon={<User size={32} />} 
                title="Citizen" 
                description="Report symptoms, track your health vitals, and receive local alerts."
                onClick={() => { setSelectedRole('citizen'); setRole('citizen'); }}
                color="bg-blue-500"
              />
              <RoleCard 
                icon={<Stethoscope size={32} />} 
                title="ASHA Worker" 
                description="Monitor community health, manage field reports, and solve local problems."
                onClick={() => { setSelectedRole('asha'); setRole('asha'); }}
                color="bg-emerald-500"
              />
              <RoleCard 
                icon={<Database size={32} />} 
                title="Government" 
                description="Access surveillance analytics, predict outbreaks, and issue public alerts."
                onClick={() => { setSelectedRole('government'); setRole('government'); }}
                color="bg-slate-800"
              />
            </div>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <button 
            onClick={() => setSelectedRole(null)}
            className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium"
          >
            <ChevronRight size={20} className="rotate-180" />
            Back to Role Selection
          </button>

          <div className="text-center mb-8">
            <div className={cn(
              "inline-flex items-center justify-center w-16 h-16 rounded-2xl text-white mb-4 shadow-lg",
              selectedRole === 'citizen' ? 'bg-blue-500 shadow-blue-200' : 
              selectedRole === 'asha' ? 'bg-emerald-600 shadow-emerald-200' : 
              'bg-slate-800 shadow-slate-200'
            )}>
              {selectedRole === 'citizen' ? <User size={32} /> : 
               selectedRole === 'asha' ? <Stethoscope size={32} /> : 
               <Database size={32} />}
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight capitalize">{selectedRole} Portal</h1>
            <p className="text-slate-500 mt-2">
              {authMode === 'login' ? 'Sign in to your account' : 'Create your secure account'}
            </p>
          </div>

          <Card className="shadow-xl border-none">
            <div className="flex mb-8 bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setAuthMode('login')}
                className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-all', authMode === 'login' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500')}
              >
                Login
              </button>
              <button 
                onClick={() => setAuthMode('signup')}
                className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-all', authMode === 'signup' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500')}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'signup' && (
                <>
                  <Input 
                    placeholder={selectedRole === 'government' ? "Government Official Name" : "Full Name"} 
                    value={fullName} 
                    onChange={e => setFullName(e.target.value)} 
                    required 
                  />
                  
                  {selectedRole === 'citizen' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <Input placeholder="Age" type="number" value={age} onChange={e => setAge(e.target.value)} required />
                        <Input placeholder="Ward No" value={wardNo} onChange={e => setWardNo(e.target.value)} required />
                      </div>
                      <Input placeholder="Street Name" value={streetName} onChange={e => setStreetName(e.target.value)} required />
                      <Input placeholder="House Number" value={houseNumber} onChange={e => setHouseNumber(e.target.value)} required />
                    </>
                  )}

                  {selectedRole === 'asha' && (
                    <Input placeholder="Ward Number" value={wardNo} onChange={e => setWardNo(e.target.value)} required />
                  )}
                </>
              )}
              <Input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} required />
              <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
              <Button type="submit" className="w-full py-4 text-lg" disabled={loading}>
                {loading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-400 flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3 text-white">
          <Shield className="text-emerald-500" />
          <span className="font-bold text-xl tracking-tight">HealthGuard</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <NavItem active={view === 'dashboard'} icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={() => setView('dashboard')} />
          <NavItem active={view === 'map'} icon={<MapIcon size={20} />} label="Disease Map" onClick={() => setView('map')} />
          <NavItem active={view === 'report'} icon={<ClipboardList size={20} />} label="Report Symptoms" onClick={() => setView('report')} />
          <NavItem active={view === 'alerts'} icon={<AlertCircle size={20} />} label="Alerts" onClick={() => setView('alerts')} />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/50 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
              <User size={20} />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsAuthOpen(true)}
            className="flex items-center gap-3 px-4 py-2 w-full text-slate-400 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-bottom border-slate-100 flex items-center justify-between px-8 md:px-12">
          <h2 className="text-lg font-semibold text-slate-800 capitalize">{view}</h2>
          <div className="flex items-center gap-4">
            <Badge variant="success">System Online</Badge>
            <button className="md:hidden text-slate-600"><Menu /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 md:p-12">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard icon={<Heart className="text-rose-500" />} label="Avg Heart Rate" value="72 bpm" trend="+2%" />
                  <StatCard icon={<Thermometer className="text-amber-500" />} label="Body Temp" value="98.6 °F" trend="Stable" />
                  <StatCard icon={<Droplets className="text-blue-500" />} label="Oxygen Level" value="98%" trend="Normal" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <ClipboardList size={20} className="text-emerald-600" />
                        Recent Health Logs
                      </h3>
                      <Button variant="outline" size="sm" onClick={() => setView('report')}>New Log</Button>
                    </div>
                    <div className="space-y-4">
                      {userStats.logs.length > 0 ? userStats.logs.map(log => (
                        <div key={log.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-slate-800">{log.symptoms}</p>
                              <Badge variant={log.status === 'solved' ? 'success' : 'danger'}>{log.status}</Badge>
                            </div>
                            <p className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()} • {log.problem_type}</p>
                          </div>
                          <div className="text-right flex flex-col items-end gap-2">
                            <Badge variant={log.risk_level === 'High' || log.risk_level === 'Critical' ? 'danger' : 'success'}>
                              {log.risk_level || 'Pending AI'}
                            </Badge>
                            {user?.role === 'asha' && log.status === 'active' && (
                              <Button variant="outline" size="sm" onClick={() => handleSolveProblem(log.id)}>Solve</Button>
                            )}
                          </div>
                        </div>
                      )) : (
                        <p className="text-center text-slate-400 py-8">No health logs found.</p>
                      )}
                    </div>
                  </Card>

                  <Card className="bg-emerald-900 text-white border-none overflow-hidden relative">
                    <div className="relative z-10">
                      <h3 className="text-xl font-bold mb-2">AI Health Insights</h3>
                      <p className="text-emerald-100/80 text-sm mb-6">Based on your recent logs and community data.</p>
                      
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/10">
                          <p className="text-sm font-medium mb-1">Seasonal Risk: Influenza</p>
                          <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-400 h-full w-3/4" />
                          </div>
                          <p className="text-[10px] mt-2 text-emerald-200">75% risk in your locality. Stay hydrated.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/10">
                          <p className="text-sm font-medium mb-1">Community Health</p>
                          <p className="text-xs text-emerald-200">4 new reports of fever in your 2km radius. Wear a mask in crowded areas.</p>
                        </div>
                      </div>
                    </div>
                    <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-emerald-400/20 rounded-full blur-3xl" />
                  </Card>
                </div>
              </motion.div>
            )}

            {view === 'map' && (
              <motion.div 
                key="map"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full rounded-3xl overflow-hidden border border-slate-200 shadow-inner"
              >
                <MapContainer 
                  center={[location?.lat || 20.5937, location?.lng || 78.9629]} 
                  zoom={13} 
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  
                  <LayersControl position="topright">
                    <LayersControl.Overlay checked name="Problem Reports">
                      <div className="leaflet-layer">
                        {mapData.symptoms.map(s => {
                          const icon = L.divIcon({
                            className: 'custom-div-icon',
                            html: `<div style="background-color: ${s.status === 'solved' ? '#10b981' : '#ef4444'}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
                            iconSize: [12, 12],
                            iconAnchor: [6, 6]
                          });

                          return (
                            <Marker key={s.id} position={[s.latitude, s.longitude]} icon={icon}>
                              <Popup>
                                <div className="p-2 min-w-[200px]">
                                  <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-slate-900">{s.predicted_disease || s.problem_type}</h4>
                                    <Badge variant={s.status === 'solved' ? 'success' : 'danger'}>{s.status}</Badge>
                                  </div>
                                  <p className="text-xs text-slate-600 mb-1">{s.symptoms}</p>
                                  <p className="text-[10px] text-slate-400 mb-2">{new Date(s.created_at).toLocaleString()}</p>
                                  
                                  {(user?.role === 'asha' || user?.role === 'government') && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patient Details</p>
                                      <p className="text-xs font-medium text-slate-800">{s.full_name} ({s.age} yrs)</p>
                                      <p className="text-xs text-slate-600">H.No: {s.house_number}, {s.street_name}</p>
                                      <p className="text-xs text-slate-600">Ward: {s.ward_no}</p>
                                      {user?.role === 'asha' && s.status === 'active' && (
                                        <Button variant="primary" size="sm" className="w-full mt-2" onClick={() => handleSolveProblem(s.id)}>Mark as Solved</Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </Popup>
                            </Marker>
                          );
                        })}
                      </div>
                    </LayersControl.Overlay>
                    
                    <LayersControl.Overlay checked name="Risk Zones">
                      <div className="leaflet-layer">
                        {mapData.symptoms.filter(s => s.risk_level === 'High' || s.risk_level === 'Critical').map(s => (
                          <Circle 
                            key={`circle-${s.id}`}
                            center={[s.latitude, s.longitude]}
                            radius={500}
                            pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.2 }}
                          />
                        ))}
                      </div>
                    </LayersControl.Overlay>

                    <LayersControl.Overlay checked name="Emergency Alerts">
                      <div className="leaflet-layer">
                        {mapData.alerts.map(a => (
                          <Marker key={`alert-${a.id}`} position={[a.latitude, a.longitude]}>
                            <Popup>
                              <div className="p-2">
                                <h4 className="font-bold text-rose-600 flex items-center gap-1">
                                  <AlertCircle size={14} /> {a.type}
                                </h4>
                                <p className="text-xs text-slate-600">{a.message}</p>
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </div>
                    </LayersControl.Overlay>
                  </LayersControl>
                </MapContainer>
              </motion.div>
            )}

            {view === 'report' && (
              <motion.div 
                key="report"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="max-w-2xl mx-auto"
              >
                <Card className="p-8">
                  <div className="mb-8">
                    <h3 className="text-2xl font-bold text-slate-900">Report Symptoms</h3>
                    <p className="text-slate-500">Your data helps AI predict outbreaks and alerts officials.</p>
                  </div>

                  <form onSubmit={handleSymptomSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Problem Type</label>
                      <div className="grid grid-cols-3 gap-3">
                        {['disease', 'drainage', 'other'].map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setProblemType(type as any)}
                            className={cn(
                              'py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all',
                              problemType === type 
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                                : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'
                            )}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Describe the problem / symptoms</label>
                      <textarea 
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none min-h-[120px]"
                        placeholder="e.g. High fever, dry cough, or drainage blockage details..."
                        value={symptoms}
                        onChange={e => setSymptoms(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-semibold text-slate-700">Severity Level</label>
                        <span className="text-emerald-600 font-bold">{severity}/10</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="10" 
                        value={severity}
                        onChange={e => setSeverity(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex flex-col gap-3">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                          <Navigation size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-emerald-900">Location Tagging</p>
                          <p className="text-xs text-emerald-700">
                            {location ? `Detected: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Detecting location...'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-4 border-t border-emerald-100 pt-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                          <Activity size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-emerald-900">Reporting Time</p>
                          <p className="text-xs text-emerald-700">
                            {new Date().toLocaleString()} (Auto-included)
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full py-4 text-lg" disabled={loading || !location}>
                      {loading ? 'Analyzing with AI...' : 'Submit Report'}
                    </Button>
                  </form>
                </Card>
              </motion.div>
            )}

            {view === 'alerts' && (
              <motion.div 
                key="alerts"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                {mapData.alerts.length > 0 ? mapData.alerts.map(alert => (
                  <Card key={alert.id} className="border-l-4 border-l-rose-500 flex items-start gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
                      <AlertCircle size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-bold text-slate-900">{alert.type}</h4>
                        <span className="text-xs text-slate-400">Active Now</span>
                      </div>
                      <p className="text-slate-600 text-sm mb-4">{alert.message}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setView('map')}>View on Map</Button>
                        <Button variant="secondary" size="sm">Safety Guidelines</Button>
                      </div>
                    </div>
                  </Card>
                )) : (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
                      <Shield size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">No Active Alerts</h3>
                    <p className="text-slate-500">Your area is currently safe.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function RoleCard({ icon, title, description, onClick, color }: { icon: React.ReactNode; title: string; description: string; onClick: () => void; color: string }) {
  return (
    <motion.button
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all text-left group flex flex-col h-full"
    >
      <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-6 transition-transform group-hover:scale-110", color)}>
        {icon}
      </div>
      <h3 className="text-2xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed mb-6 flex-1">{description}</p>
      <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
        Enter Portal <ChevronRight size={16} />
      </div>
    </motion.button>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-all group',
        active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'hover:bg-slate-800 hover:text-slate-200'
      )}
    >
      <span className={cn(active ? 'text-white' : 'text-slate-500 group-hover:text-emerald-400')}>{icon}</span>
      <span className="text-sm font-medium">{label}</span>
      {active && <ChevronRight size={14} className="ml-auto opacity-50" />}
    </button>
  );
}

function StatCard({ icon, label, value, trend }: { icon: React.ReactNode; label: string; value: string; trend: string }) {
  return (
    <Card className="flex items-center gap-6">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <div className="flex items-baseline gap-2">
          <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
          <span className={cn('text-xs font-bold', trend.includes('+') ? 'text-emerald-600' : 'text-slate-400')}>
            {trend}
          </span>
        </div>
      </div>
    </Card>
  );
}
