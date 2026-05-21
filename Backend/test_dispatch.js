const makeRequest = async () => {
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dispatch@ems.com', password: 'dispatch123' })
    });
    const { token } = await loginRes.json();
    console.log("Token:", token);

    const assignRes = await fetch('http://localhost:3001/api/dispatch/assign', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
            incidentId: '69d8d5b61db49458d35301a8',
            priority: 'HIGH',
            ambulanceType: 'ALS'
        })
    });
    const result = await assignRes.json();
    console.log("Assign Result:", result);
};
makeRequest();
