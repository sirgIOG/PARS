import express from "express";
import { createCall } from "../controllers/callController.js";

const router = express.Router();

router.post("/", createCall);

export default router;
