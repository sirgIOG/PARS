import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './src/config/db.js';
import User from './src/models/user.js';
import Ambulance from './src/models/ambulance.js';
import Hospital from './src/models/hospital.js';
import { hashPassword } from './src/utils/authUtils.js';

/**
 * Demo seed.
 * Geography: RVITM Bengaluru area (~12.91 N, 77.50 E).
 * Hospitals are spread 2–7 km from the RVITM main gate so the demo can
 * meaningfully show distance + capability trade-offs in the ranked list.
 */
const seed = async () => {
    try {
        await connectDB();
        console.log('Connected to DB');

        // ─── Hospitals (RVITM-area, category-aware) ──────────────
        const hospitalData = [
            {
                name: 'Apollo Trauma & Cardiac Centre',
                location: { lat: 12.9250, lng: 77.5050, address: 'Mysore Road, Bengaluru' },
                capabilities: { trauma: true, cardiac: true, pediatric: true, neurology: true, icu: true },
                categoryCapabilities: {
                    cardiac: true, stroke: true, trauma: true, neuro: true,
                    respiratory: true, obstetric: false, pediatric: true, burn: false, general: true
                },
                categoryTiers: {
                    cardiac: 1, stroke: 1, trauma: 1, neuro: 1,
                    respiratory: 1, pediatric: 2, general: 1
                },
                level: 1,
                capacity: { erBeds: 30, icuBeds: 12, erBedsAvailable: 22, icuBedsAvailable: 7, traumaBaysAvailable: 3 },
                load: 0.4,
                teamsOnCall: { cardiac: true, stroke: true, trauma: true, neuro: true },
                isActive: true
            },
            {
                name: 'Fortis Stroke & Neuro Hospital',
                location: { lat: 12.9050, lng: 77.4950, address: 'Bannerghatta Link, Bengaluru' },
                capabilities: { trauma: false, cardiac: true, pediatric: false, neurology: true, icu: true },
                categoryCapabilities: {
                    cardiac: true, stroke: true, trauma: false, neuro: true,
                    respiratory: true, obstetric: false, pediatric: false, burn: false, general: true
                },
                categoryTiers: {
                    stroke: 1, neuro: 1, cardiac: 2, respiratory: 2, general: 2
                },
                level: 2,
                capacity: { erBeds: 18, icuBeds: 8, erBedsAvailable: 10, icuBedsAvailable: 4, traumaBaysAvailable: 0 },
                load: 0.6,
                teamsOnCall: { cardiac: true, stroke: true, trauma: false, neuro: true },
                isActive: true
            },
            {
                name: 'RV Community Hospital',
                location: { lat: 12.9180, lng: 77.5080, address: 'Near RVITM, Bengaluru' },
                capabilities: { trauma: false, cardiac: false, pediatric: true, neurology: false, icu: true },
                categoryCapabilities: {
                    cardiac: false, stroke: false, trauma: false, neuro: false,
                    respiratory: true, obstetric: true, pediatric: true, burn: false, general: true
                },
                categoryTiers: {
                    pediatric: 2, obstetric: 2, respiratory: 3, general: 2
                },
                level: 3,
                capacity: { erBeds: 14, icuBeds: 4, erBedsAvailable: 9, icuBedsAvailable: 2, traumaBaysAvailable: 1 },
                load: 0.3,
                teamsOnCall: { cardiac: false, stroke: false, trauma: false, neuro: false },
                isActive: true
            }
        ];

        let hospitals = [];
        for (const h of hospitalData) {
            let hospital = await Hospital.findOne({ name: h.name });
            if (!hospital) {
                hospital = await Hospital.create(h);
                console.log(`✅ Created hospital: ${hospital.name}`);
            } else {
                // Update existing hospitals so re-running seed picks up new fields
                Object.assign(hospital, h);
                await hospital.save();
                console.log(`🔄 Updated hospital: ${hospital.name}`);
            }
            hospitals.push(hospital);
        }

        // ─── Ambulances ──────────────────────────────────────────
        const ambulanceData = [
            {
                ambulanceId: 'AMB-001',
                numberPlate: 'KA01AB1234',
                driver: { name: 'Ravi Kumar', phone: '9876543210', licenseNumber: 'DL-KA-2020-001' },
                vehicle: { model: 'Tata Winger', manufacturingYear: 2022, color: 'White', capacity: 4 },
                currentLocation: { lat: 12.9116, lng: 77.5006 },
                status: 'available',
                serviceLevel: 'ALS',
                equipment: { defibrillator: true, ventilator: true, stretcher: true, oxygenCylinder: true, firstAidKit: true, suction: true },
                contactNumber: '9876543210',
                notes: 'Real ALS unit (bike actor for the demo run)',
                isActive: true
            },
            {
                ambulanceId: 'AMB-VIRTUAL-001',
                numberPlate: 'KA01XY0001',
                driver: { name: 'Suresh Babu', phone: '9876543211', licenseNumber: 'DL-KA-2020-002' },
                vehicle: { model: 'Force Traveller', manufacturingYear: 2023, color: 'White', capacity: 3 },
                currentLocation: { lat: 12.9300, lng: 77.5200 },
                status: 'available',
                serviceLevel: 'BLS',
                equipment: { defibrillator: false, ventilator: false, stretcher: true, oxygenCylinder: true, firstAidKit: true, suction: false },
                contactNumber: '9876543211',
                notes: 'Virtual BLS unit (used for the reassignment moment)',
                isActive: true
            },
            {
                ambulanceId: 'AMB-VIRTUAL-002',
                numberPlate: 'KA01XY0002',
                driver: { name: 'Prakash Rao', phone: '9876543212', licenseNumber: 'DL-KA-2020-003' },
                vehicle: { model: 'Tata Winger', manufacturingYear: 2021, color: 'Red', capacity: 4 },
                currentLocation: { lat: 12.9000, lng: 77.4900 },
                status: 'available',
                serviceLevel: 'BLS',
                equipment: { defibrillator: false, ventilator: false, stretcher: true, oxygenCylinder: true, firstAidKit: true, suction: false },
                contactNumber: '9876543212',
                notes: 'Virtual BLS unit',
                isActive: true
            }
        ];

        let ambulances = [];
        for (const a of ambulanceData) {
            let ambulance = await Ambulance.findOne({ ambulanceId: a.ambulanceId });
            if (!ambulance) {
                ambulance = await Ambulance.create(a);
                console.log(`✅ Created ambulance: ${ambulance.ambulanceId}`);
            } else {
                Object.assign(ambulance, a);
                await ambulance.save();
                console.log(`🔄 Updated ambulance: ${ambulance.ambulanceId}`);
            }
            ambulances.push(ambulance);
        }

        // ─── Users ───────────────────────────────────────────────
        const usersData = [
            { name: 'Admin User', email: 'admin@hospital.com', password: 'admin123', role: 'admin', phone: '9000000001' },
            { name: 'Dispatcher One', email: 'dispatch@ems.com', password: 'dispatch123', role: 'dispatcher', phone: '9000000002' },
            { name: 'Paramedic Ravi', email: 'paramedic@ambulance.com', password: 'para123', role: 'paramedic', phone: '9000000003', ambulanceId: null },
            { name: 'Hospital Admin', email: 'hospital@health.com', password: 'hosp123', role: 'hospital', phone: '9000000004', hospitalId: null }
        ];

        for (const u of usersData) {
            let user = await User.findOne({ email: u.email });
            if (user) {
                console.log(`ℹ️  User exists: ${u.email} (${u.role})`);
                continue;
            }

            const hashedPassword = await hashPassword(u.password);
            const userData = {
                name: u.name,
                email: u.email,
                password: hashedPassword,
                role: u.role,
                phone: u.phone,
                isVerified: true,
                isActive: true
            };

            if (u.role === 'paramedic' && ambulances.length > 0) {
                userData.ambulanceId = ambulances[0]._id;
            }

            if (u.role === 'hospital' && hospitals.length > 0) {
                userData.hospitalId = hospitals[0]._id;
            }

            await User.create(userData);
            console.log(`✅ Created user: ${u.email} (${u.role})`);
        }

        console.log('\n🎉 Seed complete!');
        console.log('\nDemo Accounts:');
        console.log('  admin@hospital.com / admin123 (Admin)');
        console.log('  dispatch@ems.com / dispatch123 (Dispatcher)');
        console.log('  paramedic@ambulance.com / para123 (Paramedic → AMB-001)');
        console.log('  hospital@health.com / hosp123 (Hospital → Apollo)');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seed error:', error);
        process.exit(1);
    }
};

seed();
