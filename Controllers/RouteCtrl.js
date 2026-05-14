const Schema = require("../Models/RouteModels");
const Route = require("../Models/RouteModels");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

// GET all routes
const getAllRoute = asyncHandler(async (req, res) => {
  try {
    const { username } = req.query;
    const filter = {};

    if (username) {
      filter.username = new mongoose.Types.ObjectId(username);
    }

    const data = await Schema.find(filter)
      .populate("branchCode", "branchCode")
      .populate("economicNumber", "economicNumber")
      .populate("username", "username");

    res.status(200).json(data);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// GET route names by branch ID
const getroutenamebybranchid = asyncHandler(async (req, res) => {
  const { barnchId } = req.params;
  try {
    const result = await Schema.find({ branchCode: barnchId });
    res.status(200).json(result);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// GET route data for app API
const getAppAPi = asyncHandler(async (req, res) => {
  try {
    const { username } = req.params;
    console.log("=== GET APP API START ===");
    console.log("Fetching data for username string:", username);
    
    // 1. Find the driver first by their string username
    const DriverModel = require("../Models/DriverModel");
    const driver = await DriverModel.findOne({ username: username.trim() });
    
    let result = [];
    
    if (driver) {
      console.log("Driver found:", { id: driver._id, username: driver.username });
      // 2. Find routes assigned to this driver
      result = await Route.find({ username: driver._id })
        .populate({
          path: "economicNumber",
          select: "vehicleType",
          populate: { path: "vehicleType", select: "model" }
        })
        .select("routeNumber economicNumber");
    } else {
      console.log("DRIVER NOT FOUND in DriverModel for username:", username);
    }

    // 3. FALLBACK: If no route found for this specific driver, return ANY available route for testing
    if (result.length === 0) {
      console.log("FALLBACK: No specific route found, fetching any available route...");
      result = await Route.find()
        .limit(1)
        .populate({
          path: "economicNumber",
          select: "vehicleType",
          populate: { path: "vehicleType", select: "model" }
        })
        .select("routeNumber economicNumber");
    }

    console.log("Routes count to return:", result.length);

    const formatted = result.map(item => ({
      id: item._id,
      routeNumber: item.routeNumber || "Test-Route",
      model: item.economicNumber?.vehicleType?.model || "Test-Model"
    }));

    console.log("Formatted response data:", JSON.stringify(formatted));
    console.log("=== GET APP API END ===");

    res.status(200).json(formatted);
  } catch (error) {
    console.error("CRITICAL ERROR in getAppAPi:", error);
    res.status(404).json({ message: error.message });
  }
});

// ADD route
const addRoute = asyncHandler(async (req, res) => {
  try {
    const { routeNumber } = req.body;

    const existingRoute = await Schema.findOne({ routeNumber });
    if (existingRoute) {
      return res.status(400).json({
        success: false,
        message: `Route number "${routeNumber}" already exists`
      });
    }

    const data = await Schema.create(req.body);
    res.status(200).json({ data, message: "Route added successfully", success: true });
  } catch (error) {
    res.status(500).json({ error: error.message, message: "Route not added", success: false });
  }
});

// UPDATE route
const updateRoute = asyncHandler(async (req, res) => {
  try {
    const data = await Schema.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json({ data, message: "Route updated successfully", success: true });
  } catch (error) {
    res.status(404).json({ error: error.message, message: "Route not updated", success: false });
  }
});

// DELETE route
const deleteRoute = asyncHandler(async (req, res) => {
  try {
    const data = await Schema.findByIdAndDelete(req.params.id);
    res.status(200).json({ data, message: "Route deleted successfully", success: true });
  } catch (error) {
    res.status(404).json({ error: error.message, message: "Route not deleted", success: false });
  }
});

module.exports = {
  getAllRoute,
  addRoute,
  updateRoute,
  deleteRoute,
  getroutenamebybranchid,
  getAppAPi
};
