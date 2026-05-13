const Schema = require("../Models/DriverModel");
const Driver = require("../Models/DriverModel");
const User = require("../Models/UserModel");
const Role = require("../Models/RoleModel");
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const { generateToken } = require("../Config/jwtToken");
const bcrypt = require("bcrypt");
const { isValidObjectId } = require("../Utills/isValidObjectId");
const routeModel = require("../Models/RouteModels");
const Vehicle = require("../Models/VehicleModel");

const createuser = asyncHandler(async (req, res) => {
  try {
    const { username } = req.body;
    
    const existingUser = await Schema.findOne({ username });

    if (!existingUser) {
      const img = req.uploadedImageUrl;
      const userData = { ...req.body };

      // Clean up all possible ObjectId fields
      const objectIdFields = ['branchCode', 'route', 'department', 'position', 'assignVehicles'];
      objectIdFields.forEach(field => {
        if (userData[field] === "" || userData[field] === "null" || userData[field] === "undefined") {
          delete userData[field];
        } else if (userData[field] && !isValidObjectId(userData[field])) {
          delete userData[field];
        }
      });

      const data = await Schema.create({
        ...userData,
        profileimage: img,
      });
      res.status(200).json({ message: "User created successfully", success: true, data });
    } else {
      res.status(409).json({ message: "Username already exists", success: false });
    }
  } catch (error) {
    console.error("Error in createuser:", error);
    res.status(500).json({ 
      message: "Internal Server Error during driver creation", 
      error: error.message,
      success: false 
    });
  }
});

const loginAdmin = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const trimmedUsername = username ? username.trim() : "";
  const trimmedPassword = password ? password.trim() : "";

  let foundUser = await Schema.findOne({ username: trimmedUsername });

  if (foundUser) {
    try {
      if (isValidObjectId(foundUser.branchCode)) await foundUser.populate("branchCode");
      if (isValidObjectId(foundUser.route)) await foundUser.populate("route");
      if (isValidObjectId(foundUser.department)) await foundUser.populate("department");
      if (isValidObjectId(foundUser.position)) await foundUser.populate("position");
      if (isValidObjectId(foundUser.assignVehicles)) {
        await foundUser.populate({ path: "assignVehicles", populate: { path: "vehicleType" } });
      }
    } catch (popError) {
      console.warn("Population failed during login:", popError.message);
    }
  }

  let findVehicles = [];
  let role = "driver";

  if (foundUser) {
    findVehicles = await Vehicle.find({
      branchCode: foundUser?.branchCode?._id,
      route: foundUser?.route?._id,
    })
      .select("economicNumber vehicleType")
      .populate("vehicleType", "brand model");
  }

  if (!foundUser) {
    console.log("User not found in Driver collection, checking User collection...");
    foundUser = await User.findOne({ username: trimmedUsername }).populate("role");
    if (!foundUser) {
      console.log("User not found in any collection:", trimmedUsername);
      return res.status(401).json({ message: "User not found", success: false });
    }
    role = foundUser.role;
  }

  const isPasswordMatch = await bcrypt.compare(trimmedPassword, foundUser.password);
  const isPlainTextMatch = (trimmedPassword === foundUser.password);

  if (!isPasswordMatch && !isPlainTextMatch) {
    console.log("Password mismatch for user:", trimmedUsername);
    return res.status(401).json({ message: "Invalid password", success: false });
  }

  console.log("Login successful for user:", trimmedUsername, "Role:", role);

  const user = foundUser.toObject();
  delete user.password;
  delete user.createdAt;
  delete user.updatedAt;
  delete user.__v;

  const token = generateToken(foundUser._id);

  const roleId = foundUser.role?._id || foundUser.role;
  const userRole = roleId ? await Role.findOne({ _id: roleId }) : null;

  const branchRouteVehicle = findVehicles?.length > 0
    ? {
        _id: findVehicles[0]._id,
        economicNumber: findVehicles[0].economicNumber,
        vehicleType: findVehicles[0].vehicleType
          ? `${findVehicles[0].vehicleType.brand} ${findVehicles[0].vehicleType.model}`
          : "N/A",
      }
    : null;

  res.status(200).json({
    message: "Login successful",
    roleId: userRole ? userRole._id : null,
    roleName: userRole ? userRole.roleName : role,
    user: {
      ...user,
      branchCode: foundUser?.branchCode || "No Branch Code",
      assignBranch: foundUser?.branchCode?.branchName || "No Branch Assign",
      route: foundUser?.route || "No Route",
      EconomicNumber: branchRouteVehicle?.economicNumber,
    },
    token,
  });
});

const editUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log("Updating driver ID:", id);

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid Driver ID format", success: false });
    }

    const updatedData = { ...req.body };
    if (req.uploadedImageUrl) updatedData.profileimage = req.uploadedImageUrl;

    // Remove problematic fields for now to see if update works
    delete updatedData.password; // Don't update password for now
    
    // Minimal cleanup
    ['branchCode', 'route', 'department', 'position', 'assignVehicles'].forEach(field => {
      if (updatedData[field] === "" || !isValidObjectId(updatedData[field])) {
        delete updatedData[field];
      }
    });

    console.log("Cleaned updatedData:", JSON.stringify(updatedData));

    const updatedUser = await Schema.findByIdAndUpdate(id, updatedData, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ message: "Driver not found in database", success: false });
    }

    res.status(200).json({ 
      data: updatedUser, 
      message: "Driver updated successfully (Simplified Mode)", 
      success: true 
    });
  } catch (error) {
    console.error("FATAL Error in editUser:", error);
    res.status(500).json({ 
      message: "Backend Crash during update", 
      error: error.message,
      success: false 
    });
  }
});

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const deletedUser = await Schema.findByIdAndDelete(id);
    if (!deletedUser) return res.status(404).json({ message: "User not found", success: false });

    res.status(200).json({ message: "User deleted successfully", success: true });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
});

const getAllUser = asyncHandler(async (req, res) => {
  try {
    const users = await Schema.find({}).select("username id");
    res.status(200).json({ data: users, message: "Users fetched successfully", success: true });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
});

const getAllUserData = asyncHandler(async (req, res) => {
  try {
    const allUsers = await Schema.find({})
      .select("-password")
      .populate("branchCode", "branchName branchCode")
      .populate("route", "routeNumber routeName");

    const drivers = await User.find({ role: "686b9d3d9bd9a2274536350b" })
      .select("-password")
      .populate("branchCode", "branchName branchCode")
      .populate("route", "routeNumber routeName");

    const mergedUsers = [...allUsers, ...drivers];

    const usersWithVehicles = await Promise.all(
      mergedUsers.map(async (user) => {
        const vehicleData = await Vehicle.find({
          branchCode: user?.branchCode?._id,
          route: user?.route?._id,
        }).select("economicNumber vehicleType");

        return { ...user.toObject(), vehicles: vehicleData };
      })
    );

    res.status(200).json({ success: true, message: "Users, drivers and vehicles fetched successfully", data: usersWithVehicles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const getdriverByBranch = asyncHandler(async (req, res) => {
  try {
    const { branchIds } = req.body;
    if (!branchIds || !Array.isArray(branchIds)) {
      return res.status(400).json({ success: false, message: "branchIds must be an array" });
    }

    const routes = await routeModel.find({ branchCode: { $in: branchIds } });
    const driverIds = routes.map(route => route.username);
    const drivers = await Schema.find({ _id: { $in: driverIds } });
    const users = await User.find({ _id: { $in: driverIds } });
    const mergedUsers = [...users, ...drivers];

    res.status(200).json({ success: true, count: mergedUsers.length, data: mergedUsers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const toogleStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { driverStatus } = req.body;
    let data = await User.findByIdAndUpdate(id, { driverStatus }, { new: true });
    if (!data) data = await Driver.findByIdAndUpdate(id, { driverStatus }, { new: true });
    if (!data) return res.status(404).json({ message: "User or Driver not found", success: false });
    res.status(200).json({ message: "Status Updated Successfully!", success: true, data });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
});

const verifymobile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const { phone, isVerified } = req.body;
    if (!phone || typeof isVerified !== 'boolean') {
      return res.status(400).json({ message: "Invalid request data", success: false });
    }
    const updatedUser = await Schema.findByIdAndUpdate(id, { phone, isVerified }, { new: true });
    res.status(200).json({ data: updatedUser, message: "User updated successfully", success: true });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
});

module.exports = {
  createuser,
  loginAdmin,
  editUser,
  deleteUser,
  getAllUser,
  getAllUserData,
  getdriverByBranch,
  toogleStatus,
  verifymobile
};
