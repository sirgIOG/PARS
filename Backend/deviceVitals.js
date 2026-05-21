import { io } from "socket.io-client";

const socket = io("http://localhost:3001");

const randomInRange = (min, max, decimals = 0) => {
  const value = Math.random() * (max - min) + min;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

const emitVitals = () => {
  socket.emit("deviceVitals", {
    heartRate: Math.round(randomInRange(72, 120)),
    respiratoryRate: Math.round(randomInRange(12, 24)),
    temperature: randomInRange(36.4, 38.2, 1),
    spo2: Math.round(randomInRange(94, 99))
  });
};

const scheduleNext = () => {
  const delayMs = Math.round(randomInRange(2000, 3000));
  setTimeout(() => {
    emitVitals();
    scheduleNext();
  }, delayMs);
};

socket.on("connect", () => {
  emitVitals();
  scheduleNext();
});
