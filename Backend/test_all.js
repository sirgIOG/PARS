import fs from 'fs';

async function runTests() {
  console.log("2. Login test...");
  const loginRes = await fetch("http://localhost:3001/api/auth/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({email:"dispatch@ems.com", password:"dispatch123"})
  });
  const loginData = await loginRes.json();
  console.log("Login res:", !!loginData.token, loginData.user?.role);
  
  console.log("1. Hospitals test...");
  const hospRes = await fetch("http://localhost:3001/api/dispatch/hospitals", {
    headers: {"Authorization": `Bearer ${loginData.token}`}
  });
  const hospData = await hospRes.json();
  console.log("Hospitals count:", hospData.length);
  
  console.log("3. Calls test...");
  const callRes = await fetch("http://localhost:3001/api/calls", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      chiefComplaint: "chest pain radiating to left arm",
      symptoms: ["sweating","shortness of breath"],
      location: {lat:12.9116, lng:77.5006, address:"RVITM Gate"}
    })
  });
  const callData = await callRes.json();
  console.log("Call output:", callData.category, callData.priority);
}

runTests();
