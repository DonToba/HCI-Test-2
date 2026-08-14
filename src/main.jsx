import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Search, MapPin, LocateFixed, Navigation, Hospital, Stethoscope, Eye, Baby, Pill,
  Activity, X, ChevronRight, Phone, Mail, MapPinned, ShieldCheck, Crosshair,
  RefreshCw, HelpCircle, UserRound, LayoutDashboard, Clock3, CheckCircle2,
  AlertCircle, Sparkles, Route, Siren, BarChart3, Layers3, GitCompareArrows,
  ArrowUpRight, CircleHelp, Target, Zap, CircleDot, Building2, Users, Gauge,
  Clock, ExternalLink, Filter, ChevronDown, BrainCircuit, ShieldAlert, Info,
  SearchCheck
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./styles.css";

const FACILITIES = [
  { key:"hospitals", label:"Hospitals", short:"Hospitals", file:"/data/Hospitals.geojson", icon:Hospital, color:"#246BCE" },
  { key:"dental", label:"Dental Clinics", short:"Dental", file:"/data/Dental_Clinics.geojson", icon:Stethoscope, color:"#7557D9" },
  { key:"optical", label:"Optical Clinics", short:"Optical", file:"/data/Optical_Clinics.geojson", icon:Eye, color:"#16966E" },
  { key:"paediatrics", label:"Paediatrics", short:"Paediatrics", file:"/data/Paediatrics_Clinics.geojson", icon:Baby, color:"#E88928" },
  { key:"pharmacies", label:"Pharmacies", short:"Pharmacies", file:"/data/Pharmacies.geojson", icon:Pill, color:"#D64E52" },
  { key:"physio", label:"Physiotherapy", short:"Physio", file:"/data/Physiotherapy_Clinics.geojson", icon:Activity, color:"#14959A" }
];
const metaByKey = Object.fromEntries(FACILITIES.map(x=>[x.key,x]));

function haversine(a,b){
  const R=6371000, rad=d=>d*Math.PI/180;
  const dLat=rad(b.lat-a.lat), dLon=rad(b.lng-a.lng);
  const lat1=rad(a.lat),lat2=rad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
const fmtDist=m=>m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(1)} km`;
const estWalk=m=>Math.max(1,Math.round(m/83));
const estDrive=m=>Math.max(1,Math.round(m/330));
const initials=n=>n?.split(/\s+/).map(x=>x[0]).slice(0,2).join("").toUpperCase()||"EN";

function makeIcon(type,active=false){
  const color=type==="origin"?"#1769D2":type==="current"?"#0B756B":metaByKey[type]?.color||"#0B756B";
  return L.divIcon({
    className:"hc-marker-wrap",
    html:`<div class="hc-marker ${active?"active":""}" style="--marker:${color}">${type==="origin"||type==="current"?"●":"✚"}</div>`,
    iconSize:active?[38,38]:[29,29],iconAnchor:active?[19,19]:[14.5,14.5]
  });
}
function MapRecenter({position,zoom=15.5}){const map=useMap();useEffect(()=>{if(position)map.flyTo([position.lat,position.lng],zoom,{duration:.8})},[position,map,zoom]);return null}
function MapClick({onClick,enabled}){const map=useMap();useEffect(()=>{if(!enabled)return;const f=e=>onClick(e.latlng);map.on("click",f);return()=>map.off("click",f)},[map,onClick,enabled]);return null}

function App(){
  const [data,setData]=useState({}); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  const [appMode,setAppMode]=useState("locator");
  const [query,setQuery]=useState(""); const [searchMode,setSearchMode]=useState("id");
  const [selected,setSelected]=useState(null); const [selectedHospital,setSelectedHospital]=useState(null); const [location,setLocation]=useState(null); const [focusPoint,setFocusPoint]=useState(null);
  const [locationMode,setLocationMode]=useState("database"); const [radius,setRadius]=useState(250);
  const [plan,setPlan]=useState("All Plans"); const [active,setActive]=useState(Object.fromEntries(FACILITIES.map(x=>[x.key,true])));
  const [emergency,setEmergency]=useState(false); const [detail,setDetail]=useState(null);
  const [compare,setCompare]=useState([]); const [showAll,setShowAll]=useState(false); const [natural,setNatural]=useState("");
  const [nlActive,setNlActive]=useState(false); const [geoError,setGeoError]=useState("");
  const [coverageMode,setCoverageMode]=useState(false); const [executiveTab,setExecutiveTab]=useState("overview");

  useEffect(()=>{
    Promise.all([fetch("/data/Enrollees.geojson").then(r=>r.json()),...FACILITIES.map(x=>fetch(x.file).then(r=>r.json()))])
    .then(([enr,...fac])=>{
      const enrollees=enr.features.map((f,i)=>({id:f.properties["Enrollee ID"]||`ENR-${String(i+1).padStart(6,"0")}`,name:f.properties.Name||"Unnamed",address:f.properties.Address||"",plan:f.properties["HMO Plan"]||"",lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0]}));
      const out={enrollees};
      FACILITIES.forEach((m,i)=>out[m.key]=fac[i].features.map((f,j)=>{const p=f.properties||{};return{id:`${m.key}-${j}`,category:m.key,name:p.Name||"Unnamed facility",address:p.Address||"Address unavailable",state:p.State||"",lga:p.LGA||"",plan:p["HMO Plan"]||"",service:p.ServiceTyp||"Healthcare",phone:p["Phone Number"]||"",email:p["Email Address"]||"",lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0]}}));
      setData(out);setSelected(enrollees[0]);setLocation(enrollees[0]&&{lat:enrollees[0].lat,lng:enrollees[0].lng});setLoading(false);
    }).catch(e=>{setError(e.message);setLoading(false)});
  },[]);

  const plans=useMemo(()=>["All Plans",...Array.from(new Set(FACILITIES.flatMap(m=>(data[m.key]||[]).map(x=>x.plan).filter(Boolean)))).sort()],[data]);
  const searchResults=useMemo(()=>{
    const q=query.trim().toLowerCase(); if(!q)return[];
    if(searchMode==="hospital") return (data.hospitals||[]).filter(f=>[f.name,f.address,f.state,f.lga,f.service].some(v=>(v||"").toLowerCase().includes(q))).slice(0,7);
    return (data.enrollees||[]).filter(e=>searchMode==="id"?e.id.toLowerCase().includes(q):[e.id,e.name,e.address].some(v=>(v||"").toLowerCase().includes(q))).slice(0,7);
  },[query,searchMode,data.enrollees,data.hospitals]);

  const allFacilities=useMemo(()=>FACILITIES.flatMap(m=>data[m.key]||[]),[data]);
  const nearby=useMemo(()=>{
    if(!location)return[];
    const effectiveRadius=emergency?5000:radius;
    return FACILITIES.flatMap(m=>active[m.key]?(data[m.key]||[]):[]).map(f=>({...f,distance:haversine(location,f)}))
      .filter(f=>f.distance<=effectiveRadius&&(plan==="All Plans"||!f.plan||f.plan===plan))
      .sort((a,b)=>a.distance-b.distance);
  },[location,data,active,radius,plan,emergency]);

  const recommended=useMemo(()=>{
    if(!location||!nearby.length)return null;
    return [...nearby].map(f=>{
      const distanceScore=Math.max(0,1-f.distance/(emergency?5000:Math.max(radius,250)));
      const networkScore=(!selected?.plan||!f.plan||f.plan===selected.plan)?1:.35;
      const emergencyScore=emergency?(f.category==="hospitals"?1:0.15):1;
      const serviceScore=(selected?.requestedService&&f.service?.toLowerCase().includes(selected.requestedService.toLowerCase()))?1:.75;
      const openScore=1;
      const score=Math.round((distanceScore*.35+networkScore*.30+emergencyScore*.20+serviceScore*.10+openScore*.05)*100);
      return {...f,score};
    }).sort((a,b)=>b.score-a.score)[0];
  },[nearby,location,radius,emergency,selected]);

  const counts=useMemo(()=>Object.fromEntries(FACILITIES.map(m=>[m.key,nearby.filter(x=>x.category===m.key).length])),[nearby]);
  const networkTotal=allFacilities.length;
  const coverageStats=useMemo(()=>{
    const enrs=data.enrollees||[]; if(!enrs.length)return{covered:0,total:0,pct:0,avg:0,gaps:0};
    const distances=enrs.map(e=>{const list=allFacilities.map(f=>haversine(e,f));return Math.min(...list)});
    const covered=distances.filter(d=>d<=250).length;
    const avg=distances.reduce((a,b)=>a+b,0)/distances.length;
    return{covered,total:enrs.length,pct:Math.round(covered/enrs.length*100),avg,gaps:enrs.length-covered,distances};
  },[data.enrollees,allFacilities]);

  const nearest=showAll?nearby:nearby.slice(0,7);
  const centre=location||{lat:6.5244,lng:3.3792};

  function chooseEnrollee(e){setSelected(e);setSelectedHospital(null);setQuery(e.id);setLocation({lat:e.lat,lng:e.lng});setFocusPoint({lat:e.lat,lng:e.lng});setLocationMode("database");setEmergency(false);setDetail(null);setShowAll(false);setCompare([]);setNlActive(false);setAppMode("locator")}
  function chooseHospital(f){
    // Hospital search is an independent origin search: the selected hospital
    // becomes the centre of the 250 m search and ALL healthcare facility types
    // remain visible around it.
    setSelected(null);
    setSelectedHospital(f);
    setQuery(f.name);
    setLocation({lat:f.lat,lng:f.lng});
    setFocusPoint({lat:f.lat,lng:f.lng});
    setLocationMode("hospital");
    setRadius(250);
    setEmergency(false);
    setActive(Object.fromEntries(FACILITIES.map(m=>[m.key,true])));
    setDetail(null);
    setShowAll(false);
    setCompare([]);
    setNlActive(false);
    setAppMode("locator");
  }
  function useGPS(){
    if(!navigator.geolocation){setGeoError("Geolocation is not supported.");return}
    setGeoError("");
    navigator.geolocation.getCurrentPosition(p=>{setLocation({lat:p.coords.latitude,lng:p.coords.longitude});setFocusPoint({lat:p.coords.latitude,lng:p.coords.longitude});setLocationMode("current");setDetail(null);setShowAll(false)},()=>setGeoError("Location access was not granted. Check browser permissions."));
  }
  function chooseMap(p){setLocation({lat:p.lat,lng:p.lng});setFocusPoint({lat:p.lat,lng:p.lng});setLocationMode("map");setDetail(null)}
  function toggleCompare(f){setCompare(s=>s.some(x=>x.id===f.id)?s.filter(x=>x.id!==f.id):s.length<3?[...s,f]:s)}
  function directions(f){window.open(`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`,"_blank","noopener,noreferrer")}
  function parseNatural(){
    const q=natural.toLowerCase();
    if(!q)return;
    if(q.includes("emergency")){setEmergency(true);setActive(Object.fromEntries(FACILITIES.map(m=>[m.key,m.key==="hospitals"])));}
    else if(q.includes("dental")){setEmergency(false);setActive(Object.fromEntries(FACILITIES.map(m=>[m.key,m.key==="dental"])));}
    else if(q.includes("pharmacy")){setEmergency(false);setActive(Object.fromEntries(FACILITIES.map(m=>[m.key,m.key==="pharmacies"])));}
    else if(q.includes("optical")){setEmergency(false);setActive(Object.fromEntries(FACILITIES.map(m=>[m.key,m.key==="optical"])));}
    const km=q.match(/(\d+(?:\.\d+)?)\s*km/); if(km)setRadius(Math.min(5000,Math.max(100,Math.round(parseFloat(km[1])*1000))));
    setNlActive(true);
  }

  if(loading)return <div className="loading"><div className="load-logo"><ShieldCheck/></div><b>HealthConnect</b><span>Loading provider intelligence…</span><i/></div>;
  if(error)return <div className="loading"><AlertCircle/><b>Data could not be loaded</b><span>{error}</span></div>;

  return <div className="app">
    <header className="header">
      <div className="brand"><div className="brand-icon"><ShieldCheck size={23}/></div><div><h1>HealthConnect</h1><p>Provider Locator & Network Intelligence</p></div></div>
      <div className="top-tabs">
        <button className={appMode==="locator"?"active":""} onClick={()=>setAppMode("locator")}><MapPinned size={15}/> Provider Locator</button>
        <button className={appMode==="network"?"active":""} onClick={()=>setAppMode("network")}><BarChart3 size={15}/> Network Intelligence</button>
      </div>
      <div className="header-right"><div className="network-live"><span/> Network live</div><button><HelpCircle size={15}/> Help</button><div className="user"><UserRound size={15}/> Operations</div></div>
    </header>

    {appMode==="locator"?<div className="workspace">
      <aside className="left-panel">
        <section className="panel search-panel">
          <div className="kicker">PROVIDER & ENROLLEE SEARCH</div>
          <div className="search-tabs"><button className={searchMode==="id"?"active":""} onClick={()=>{setSearchMode("id");setQuery("")}}>Search by ID</button><button className={searchMode==="name"?"active":""} onClick={()=>{setSearchMode("name");setQuery("")}}>Search by Name</button><button className={searchMode==="hospital"?"active":""} onClick={()=>{setSearchMode("hospital");setQuery("");setSelectedHospital(null)}}>Search by Hospital</button></div>
          <div className="searchbox"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={searchMode==="hospital"?"Search hospital name or location":searchMode==="id"?"Enter enrollee ID":"Enter enrollee name"}/>{query&&<button onClick={()=>setQuery("")}><X size={14}/></button>}</div>
          {searchResults.length>0&&<div className="results">{searchResults.map(item=>searchMode==="hospital"?<button key={item.id} onClick={()=>chooseHospital(item)}><span className="avatar"><Hospital size={15}/></span><span><b>{item.name}</b><small>Hospital · {item.address}</small></span><ChevronRight size={14}/></button>:<button key={item.id} onClick={()=>chooseEnrollee(item)}><span className="avatar">{initials(item.name)}</span><span><b>{item.id}</b><small>{item.name} · {item.address}</small></span><ChevronRight size={14}/></button>)}</div>}
          <div className="quick"><span>{searchMode==="hospital"?"QUICK HOSPITAL SEARCH":"QUICK SEARCH"}</span>{searchMode==="hospital"?(data.hospitals||[]).slice(0,3).map(f=><button key={f.id} onClick={()=>chooseHospital(f)}>{f.name}</button>):(data.enrollees||[]).slice(0,3).map(e=><button key={e.id} onClick={()=>chooseEnrollee(e)}>{e.id}</button>)}</div>
        </section>

        <section className="panel enrollee">
          {selectedHospital?<><div className="kicker">SELECTED HOSPITAL</div><div className="person"><span className="hospital-avatar"><Hospital size={17}/></span><div><b>HOSPITAL SEARCH</b><h3>{selectedHospital.name}</h3></div><span className="active-pill">Origin</span></div>
          <div className="address"><MapPin size={14}/>{selectedHospital.address}</div><div className="plan-line"><span>Search area</span><b>250 m radius</b></div></>:<><div className="kicker">SELECTED ENROLLEE</div>
          {selected&&<><div className="person"><span>{initials(selected.name)}</span><div><b>{selected.id}</b><h3>{selected.name}</h3></div><span className="active-pill">Active</span></div>
          <div className="address"><MapPin size={14}/>{selected.address}</div><div className="plan-line"><span>HMO Plan</span><b>{selected.plan||"Not specified"}</b></div></>}</>}
        </section>

        <section className="panel">
          <div className="kicker">SMART SEARCH</div>
          <div className="ai-search"><BrainCircuit size={16}/><input value={natural} onChange={e=>setNatural(e.target.value)} onKeyDown={e=>e.key==="Enter"&&parseNatural()} placeholder="e.g. emergency hospital within 2 km"/><button onClick={parseNatural}><Sparkles size={14}/></button></div>
          <div className="smart-hint"><Sparkles size={11}/> Try: “find a dental clinic within 1 km”</div>
          {nlActive&&<div className="nl-result"><CheckCircle2 size={13}/><span>Search interpreted and filters applied.</span></div>}
        </section>

        <section className="panel">
          <div className="kicker">SEARCH OPTIONS</div>
          <div className="option-row"><span>Radius</span><b>{emergency?"5 km":`${radius} m`}</b></div>
          {!emergency&&<input className="range" type="range" min="100" max="2000" step="50" value={radius} onChange={e=>setRadius(+e.target.value)}/>}
          <div className="select"><small>HMO Plan</small><select value={plan} onChange={e=>setPlan(e.target.value)}>{plans.map(p=><option key={p}>{p}</option>)}</select></div>
          <div className="provider-head"><span>Provider Types</span><button onClick={()=>setActive(Object.fromEntries(FACILITIES.map(m=>[m.key,true])))}>Select all</button></div>
          <div className="checks">{FACILITIES.map(m=>{const I=m.icon;return <label key={m.key}><input type="checkbox" checked={active[m.key]} onChange={()=>setActive(s=>({...s,[m.key]:!s[m.key]}))}/><span className="check" style={{"--c":m.color}}><I size={10}/></span><span>{m.label}</span><b>{counts[m.key]||0}</b></label>})}</div>
        </section>

        <section className="panel location">
          <div className="kicker">LOCATION MODE</div>
          <button className={locationMode==="database"?"loc active":"loc"} disabled={!selected} onClick={()=>{setLocation({lat:selected.lat,lng:selected.lng});setLocationMode("database")}}><span className="radio"/><span><b>Use Enrollee Address</b><small>Registered database location</small></span></button>
          <button className={locationMode==="current"?"loc active":"loc"} onClick={useGPS}><span className="radio"/><span><b>Use Current Location</b><small>For clients away from registered address</small></span><LocateFixed size={15}/></button>
          <button className={locationMode==="map"?"loc active":"loc"} onClick={()=>setLocationMode("map")}><span className="radio"/><span><b>Click on Map</b><small>Simulate another client location</small></span><MapPinned size={15}/></button>
          {geoError&&<div className="error-note">{geoError}</div>}
          <button className={emergency?"emergency-btn on":"emergency-btn"} onClick={()=>{setEmergency(v=>!v);if(!emergency)setActive(Object.fromEntries(FACILITIES.map(m=>[m.key,m.key==="hospitals"])));else setActive(Object.fromEntries(FACILITIES.map(m=>[m.key,true])))}}><Siren size={15}/>{emergency?"Emergency Mode Active":"Emergency Mode"}</button>
        </section>
      </aside>

      <main className="map-area">
        <div className="map-topbar"><div className="map-context"><span className="context-dot"/><span>{locationMode==="database"?`Registered address · ${selected?.address||"—"}`:locationMode==="hospital"?`Hospital origin · ${selectedHospital?.name||"—"}`:locationMode==="current"?"Current GPS location":"Map-selected location"}</span></div><div className="map-actions"><button onClick={()=>setCoverageMode(v=>!v)} className={coverageMode?"selected":""}><Layers3 size={14}/>{coverageMode?"Coverage on":"Coverage"}</button><button onClick={()=>setShowAll(true)}><Filter size={14}/> Results <b>{nearby.length}</b></button></div></div>
        {recommended&&<div className="recommend-card"><div className="recommend-icon"><Sparkles size={16}/></div><div className="recommend-main"><div className="rec-label">RECOMMENDED PROVIDER <span>{recommended.score}% MATCH</span></div><b>{recommended.name}</b><small>{metaByKey[recommended.category].label} · {fmtDist(recommended.distance)} · ~{estDrive(recommended.distance)} min drive</small></div><div className="rec-tags"><span>✓ {(!selected?.plan||!recommended.plan||recommended.plan===selected.plan)?"In network":"Plan check"}</span><span>✓ {emergency?"Emergency":"Suitable"}</span></div><button onClick={()=>setDetail(recommended)}>View <ChevronRight size={14}/></button></div>}
        <MapContainer center={[centre.lat,centre.lng]} zoom={15.5} className="map" zoomControl={false}>
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
          <MapRecenter position={focusPoint||location} zoom={locationMode==="current"?14.8:15.5}/>
          <MapClick onClick={chooseMap} enabled={locationMode==="map"}/>
          {location&&<><Circle center={[location.lat,location.lng]} radius={emergency?5000:radius} pathOptions={{color:emergency?"#D64E52":"#1769D2",fillColor:emergency?"#D64E52":"#1769D2",fillOpacity:.10,weight:2,dashArray:"6 5"}}/><Marker position={[location.lat,location.lng]} icon={makeIcon(locationMode==="current"?"current":"origin",true)}><Popup><div className="popup"><b>{locationMode==="database"?selected?.name:locationMode==="hospital"?selectedHospital?.name:locationMode==="current"?"Current location":"Map-selected location"}</b><span>{locationMode==="database"?selected?.address:locationMode==="hospital"?selectedHospital?.address:"Search origin"}</span><strong>{emergency?"Emergency search · 5 km":`${radius} m provider search`}</strong></div></Popup></Marker></>}
          {coverageMode&&allFacilities.slice(0,250).map(f=><Circle key={`cov-${f.id}`} center={[f.lat,f.lng]} radius={180} pathOptions={{color:metaByKey[f.category].color,fillColor:metaByKey[f.category].color,fillOpacity:.055,weight:0.5}}/>)}
          {nearby.slice(0,showAll?180:80).map(f=><Marker key={f.id} position={[f.lat,f.lng]} icon={makeIcon(f.category,detail?.id===f.id)} eventHandlers={{click:()=>setDetail(f)}}><Popup><div className="popup"><b>{f.name}</b><span className="cat">{metaByKey[f.category].label} · {fmtDist(f.distance)}</span><span>{f.address}</span><strong>{(!selected?.plan||!f.plan||f.plan===selected.plan)?"✓ In-network / eligible":"Plan verification required"}</strong></div></Popup></Marker>)}
        </MapContainer>
        <div className="map-help"><MapPin size={12}/> Search <b>Search by Hospital</b> to centre the map on a hospital and find all healthcare facilities within 250 m, or use an enrollee search to locate facilities around the member.</div>
        <div className="map-zoom"><button><Navigation size={15}/></button><button onClick={()=>window.location.reload()}><RefreshCw size={14}/></button></div>

        <section className="result-strip">
          <div className="strip-head"><div><h2>{emergency?"Emergency facilities":"Providers"} <span>within {emergency?"5 km":`${radius} m`}</span></h2><small>{nearby.length} matching facilities · sorted by suitability and distance</small></div><div className="strip-buttons"><button onClick={()=>setShowAll(v=>!v)}>View all <ChevronRight size={14}/></button></div></div>
          <div className="strip-cards">{FACILITIES.map(m=>{const I=m.icon;return <div key={m.key} className="strip-card" style={{"--accent":m.color}}><I size={16}/><span>{m.short}</span><b>{counts[m.key]||0}</b></div>})}<div className="strip-card total"><Target size={16}/><span>Total matches</span><b>{nearby.length}</b></div></div>
        </section>
      </main>

      <aside className="right-panel">
        <div className="dash-head"><div><div className="kicker">LIVE DECISION SUPPORT</div><h2>Provider Intelligence</h2></div><span className={emergency?"badge red":"badge"}>{emergency?"Emergency":"250 m search"}</span></div>
        <div className="metric-grid"><Metric label="Eligible Nearby" value={nearby.length} icon={<SearchCheck/>}/><Metric label="Network Types" value={new Set(nearby.map(x=>x.category)).size} icon={<Building2/>}/><Metric label="Coverage" value={`${coverageStats.pct}%`} icon={<Gauge/>} green/><Metric label="Avg. Distance" value={fmtDist(coverageStats.avg)} icon={<Route/>}/></div>

        {detail&&!detail.compareView&&<ProviderDrawer f={detail} selected={selected} onClose={()=>setDetail(null)} onDirections={()=>directions(detail)} onCompare={()=>toggleCompare(detail)} comparing={compare.some(x=>x.id===detail.id)}/>}
        {!detail&&<><section className="dash-section">
          <div className="section-title"><span>Nearest Providers</span><button onClick={()=>setShowAll(true)}>View all</button></div>
          {nearest.map(f=><ProviderRow key={f.id} f={f} selected={selected} onClick={()=>setDetail(f)} onCompare={()=>toggleCompare(f)} comparing={compare.some(x=>x.id===f.id)}/>)}
          {!nearby.length&&<div className="no-results"><AlertCircle/><b>No matching providers</b><span>Increase the radius or change filters.</span></div>}
        </section>
        <section className="dash-section">
          <div className="section-title"><span>Coverage Snapshot</span><button onClick={()=>setAppMode("network")}>Analyze <ArrowUpRight size={13}/></button></div>
          <div className="coverage-card"><div className="coverage-score"><strong>{coverageStats.pct}%</strong><span>of sample enrollees have a provider within 250 m</span></div><div className="coverage-bar"><i style={{width:`${coverageStats.pct}%`}}/></div><div className="coverage-mini"><span><b>{coverageStats.covered}</b> covered</span><span><b>{coverageStats.gaps}</b> gaps</span></div></div>
        </section>
        <section className="dash-section active-search"><div className="section-title"><span>Active Search</span><Clock3 size={13}/></div><div className="active-grid"><span>Location</span><b>{locationMode==="database"?"Registered address":locationMode==="hospital"?"Selected hospital":locationMode==="current"?"Current GPS":"Map selected"}</b><span>Plan</span><b>{plan}</b><span>Mode</span><b>{emergency?"Emergency · 5 km":`${radius} m radius`}</b></div></section></>}
      </aside>

      {compare.length>0&&<div className="compare-bar"><div><GitCompareArrows size={18}/><span><b>{compare.length}</b> provider{compare.length>1?"s":""} selected</span></div><button onClick={()=>setCompare([])}>Clear</button><button className="compare-main" onClick={()=>setDetail({compareView:true,items:compare})}>Compare providers</button></div>}
      {showAll&&<div className="modal-backdrop" onClick={()=>setShowAll(false)}><div className="results-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="kicker">SEARCH RESULTS</div><h2>{nearby.length} matching providers</h2></div><button onClick={()=>setShowAll(false)}><X/></button></div><div className="modal-list">{nearby.slice(0,120).map(f=><ProviderRow key={f.id} f={f} selected={selected} onClick={()=>{setShowAll(false);setDetail(f)}} onCompare={()=>toggleCompare(f)} comparing={compare.some(x=>x.id===f.id)}/>)}</div></div></div>}
      {detail?.compareView&&<CompareModal items={detail.items} onClose={()=>setDetail(null)} onDirections={directions}/>}
    </div>:<NetworkIntelligence data={data} allFacilities={allFacilities} coverageStats={coverageStats} setAppMode={setAppMode} setCoverageMode={setCoverageMode} setLocation={setLocation} setLocationMode={setLocationMode} setSelected={setSelected}/>}
  </div>
}

function Metric({label,value,icon,green}){return <div className={green?"metric green":"metric"}><span>{icon}</span><small>{label}</small><strong>{value}</strong></div>}
function ProviderRow({f,selected,onClick,onCompare,comparing}){
  const M=metaByKey[f.category];const I=M.icon;const eligible=!selected?.plan||!f.plan||f.plan===selected.plan;
  return <div className="provider-row" onClick={onClick}><span className="provider-icon" style={{color:M.color,background:`${M.color}13`}}><I size={15}/></span><span className="provider-info"><b>{f.name}</b><small>{M.label} · {fmtDist(f.distance)} · ~{estWalk(f.distance)} min walk</small><em className={eligible?"good":"warn"}>{eligible?"✓ In network":"⚠ Verify plan"}</em></span><span className="provider-actions"><b>{fmtDist(f.distance)}</b><button title="Compare" onClick={e=>{e.stopPropagation();onCompare()}} className={comparing?"compare active":"compare"}><GitCompareArrows size={12}/></button></span></div>
}
function ProviderDrawer({f,selected,onClose,onDirections,onCompare,comparing}){
  const M=metaByKey[f.category];const I=M.icon;const eligible=!selected?.plan||!f.plan||f.plan===selected.plan;
  return <div className="provider-drawer"><div className="drawer-head"><div><div className="kicker">PROVIDER PROFILE</div><h3>{f.name}</h3></div><button onClick={onClose}><X size={16}/></button></div><div className="drawer-type"><span style={{color:M.color,background:`${M.color}14`}}><I size={15}/></span><b>{M.label}</b><em>{eligible?"IN NETWORK":"PLAN CHECK"}</em></div><div className="drawer-score"><div><small>Provider match</small><strong>{Math.min(98,Math.round(75+Math.max(0,25-f.distance/200)))}%</strong></div><div><span>Distance</span><b>{fmtDist(f.distance)}</b></div><div><span>Drive</span><b>~{estDrive(f.distance)} min</b></div></div><div className="drawer-section"><label>Address</label><p><MapPin size={13}/>{f.address}</p></div><div className="drawer-section"><label>Services</label><div className="service-tags"><span>{f.service||"Healthcare"}</span><span>General care</span>{f.category==="hospitals"&&<span>Emergency capable</span>}</div></div><div className="drawer-section"><label>Contact</label>{f.phone&&<p><Phone size={13}/>{f.phone}</p>}{f.email&&<p><Mail size={13}/>{f.email}</p>}</div><div className="drawer-section"><label>Network status</label><div className="network-checks"><span>✓ HMO eligibility {eligible?"confirmed":"requires verification"}</span><span>✓ Provider located within search area</span><span>✓ Service category matched</span></div></div><div className="drawer-actions"><button onClick={onDirections}><Navigation size={14}/> Directions</button><button onClick={onCompare} className={comparing?"selected":""}><GitCompareArrows size={14}/> {comparing?"Selected":"Compare"}</button></div></div>
}
function CompareModal({items,onClose,onDirections}){return <div className="modal-backdrop" onClick={onClose}><div className="compare-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="kicker">PROVIDER COMPARISON</div><h2>Compare selected providers</h2></div><button onClick={onClose}><X/></button></div><div className="compare-grid">{items.map((f,i)=>{const M=metaByKey[f.category];const I=M.icon;return <div className="compare-card" key={f.id}><span className="compare-number">{i+1}</span><span className="provider-icon large" style={{color:M.color,background:`${M.color}13`}}><I/></span><h3>{f.name}</h3><small>{M.label}</small><div className="compare-metrics"><span>Distance<b>{fmtDist(f.distance)}</b></span><span>Drive<b>~{estDrive(f.distance)} min</b></span><span>Network<b className="good">✓ Eligible</b></span><span>Service<b>{f.service||"General"}</b></span></div><button onClick={()=>onDirections(f)}>Get directions <ExternalLink size={12}/></button></div>})}</div></div></div>}

function NetworkIntelligence({data,allFacilities,coverageStats,setAppMode,setCoverageMode,setLocation,setLocationMode,setSelected}){
  const byCategory=FACILITIES.map(m=>({...m,count:(data[m.key]||[]).length}));
  const max=Math.max(...byCategory.map(x=>x.count),1);
  const byState=useMemo(()=>{const c={};allFacilities.forEach(f=>c[f.state||"Unknown"]=(c[f.state||"Unknown"]||0)+1);return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,8)},[allFacilities]);
  const gaps=(data.enrollees||[]).map((e,i)=>{const ds=allFacilities.map(f=>haversine(e,f));const min=Math.min(...ds);return{...e,min,index:i}}).sort((a,b)=>b.min-a.min);
  const gapCount=gaps.filter(x=>x.min>250).length;
  return <div className="network-page">
    <div className="network-hero"><div><div className="kicker">EXECUTIVE NETWORK INTELLIGENCE</div><h1>Healthcare Network Coverage</h1><p>See how effectively the provider network serves enrolled members — and identify where coverage needs attention.</p></div><div className="hero-actions"><button onClick={()=>setAppMode("locator")}><MapPinned size={15}/> Return to Locator</button><button className="primary" onClick={()=>{setCoverageMode(true);setAppMode("locator")}}><Layers3 size={15}/> Coverage Map</button></div></div>
    <div className="exec-metrics"><div><Users/><small>Sample Enrollees</small><strong>{data.enrollees?.length||0}</strong><span>members in analysis</span></div><div><Target/><small>250 m Coverage</small><strong>{coverageStats.pct}%</strong><span>members covered</span></div><div><ShieldAlert/><small>Coverage Gaps</small><strong>{gapCount}</strong><span>members without nearby provider</span></div><div><Route/><small>Avg. Nearest Provider</small><strong>{fmtDist(coverageStats.avg)}</strong><span>straight-line estimate</span></div></div>
    <div className="network-grid">
      <section className="network-card large"><div className="card-head"><div><div className="kicker">NETWORK MIX</div><h2>Provider distribution</h2></div><span>{allFacilities.length.toLocaleString()} providers</span></div><div className="bars">{byCategory.map(m=>{const I=m.icon;return <div className="net-bar" key={m.key}><div><span className="net-icon" style={{color:m.color,background:`${m.color}13`}}><I size={14}/></span><b>{m.label}</b><strong>{m.count.toLocaleString()}</strong></div><i><em style={{width:`${m.count/max*100}%`,background:m.color}}/></i></div>})}</div></section>
      <section className="network-card"><div className="card-head"><div><div className="kicker">NETWORK HEALTH</div><h2>Coverage score</h2></div><Gauge size={17}/></div><div className="big-score">{coverageStats.pct}%</div><p>of sample enrollees have at least one provider within the 250 m service target.</p><div className="score-track"><i style={{width:`${coverageStats.pct}%`}}/></div><div className="score-legend"><span><i/>Covered</span><span><i/>Gap</span></div></section>
      <section className="network-card"><div className="card-head"><div><div className="kicker">TOP LOCATIONS</div><h2>Provider concentration</h2></div><BarChart3 size={17}/></div><div className="state-list">{byState.map(([s,c])=><div key={s}><span>{s||"Unknown"}</span><b>{c}</b><i><em style={{width:`${c/byState[0][1]*100}%`}}/></i></div>)}</div></section>
      <section className="network-card large"><div className="card-head"><div><div className="kicker">NETWORK GAPS</div><h2>Members furthest from a provider</h2></div><span className="warn-badge">{gapCount} attention areas</span></div><div className="gap-list">{gaps.slice(0,6).map(e=><div key={e.id}><span className="gap-avatar">{initials(e.name)}</span><div><b>{e.id} · {e.name}</b><small>{e.address}</small></div><strong>{fmtDist(e.min)}</strong><button onClick={()=>{setSelected(e);setLocation({lat:e.lat,lng:e.lng});setLocationMode("database");setAppMode("locator")}}>Locate <ArrowUpRight size={12}/></button></div>)}</div></section>
    </div>
    <div className="network-footer"><ShieldCheck size={16}/><span>HealthConnect turns provider data into operational decisions: locate the right facility for an enrollee and identify network coverage gaps for management.</span></div>
  </div>
}

createRoot(document.getElementById("root")).render(<App/>);
