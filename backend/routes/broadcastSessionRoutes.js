const express = require("express");
const router = express.Router();
const controller = require("../controllers/broadcastSessionController");
const { requireAdminAuth } = require("../middleware/adminAuth");

router.get("/active", controller.getActiveSession);
router.get("/", requireAdminAuth, controller.listSessions);
router.get("/:id", requireAdminAuth, controller.getSessionReport);
router.post("/start", requireAdminAuth, controller.startSession);
router.post("/stop", requireAdminAuth, controller.stopSession);

module.exports = router;
