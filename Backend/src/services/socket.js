import { Server } from "socket.io";
import { handleVitals } from "./patientService.js";

let io;

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*",
        },
    });

    io.on("connection", (socket) => {
        console.log("Device connected:", socket.id);

        // Receive vitals from ambulance via WebSocket
        socket.on("sendVitals", async (data) => {
            console.log("Vitals received from ambulance:", data);

            // Handle in service
            try {
                await handleVitals(data);
            } catch (error) {
                console.error("Error handling vitals:", error);
            }
        });

        // Receive device vitals (from wearable/monitor)
        socket.on("deviceVitals", async (data) => {
            console.log("Device vitals received:", data);
            // Broadcast to all connected clients
            io.emit("deviceVitals", data);
        });

        // Receive live vitals stream from ambulance UI
        socket.on("liveVitals", (data) => {
            if (!data) return;
            io.emit("liveVitals", {
                ...data,
                timestamp: data.timestamp || new Date()
            });
        });

        socket.on("disconnect", () => {
            console.log("Device disconnected:", socket.id);
        });
    });
};

export const getIO = () => io;