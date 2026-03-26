const express = require("express");
const router = express.Router();
const controller = require("../controllers/greetingController");

router.post("/", controller.addGreeting);
router.get("/", controller.listGreetings);

module.exports = router;
