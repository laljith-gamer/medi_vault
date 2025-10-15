// ============================================================================
// MEDIVAULT - Complete Application JavaScript (CORRECTED VERSION)
// Healthcare Record Management System - Supabase Integration
// Version: 2.3 CORRECTED | Date: October 2025
// Patient Verification Fixed - Name Field Removed
// ============================================================================

// ============================================================================
// SUPABASE CONFIGURATION
// ============================================================================
const SUPABASE_URL = "https://uqozcnbbbkrsecfiecme.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxb3pjbmJiYmtyc2VjZmllY21lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNjc1MzksImV4cCI6MjA3NTk0MzUzOX0.uDT17azQATeozQeZDzWRBRMgHBVgko9VZB2vLUbLXD4";

// Validate credentials on load
if (
  SUPABASE_URL === "YOUR_SUPABASE_URL_HERE" ||
  !SUPABASE_URL.includes("supabase.co")
) {
  console.error("❌ CRITICAL: Please update Supabase credentials in app.js!");
  console.error("Get your credentials from: https://supabase.com/dashboard");
}

// Global variables
let supabase;
let isSupabaseInitialized = false;

// ============================================================================
// NETWORK DIAGNOSTICS
// ============================================================================
async function checkNetworkConnectivity() {
  console.log("🔍 Running network diagnostics...");

  // Test 1: Internet connection
  try {
    await fetch("https://www.google.com/generate_204", {
      mode: "no-cors",
      cache: "no-cache",
    });
    console.log("✅ Internet connection: OK");
  } catch (error) {
    console.error("❌ No internet connection");
    showConnectionStatus("No internet connection detected", "error", 0);
    return false;
  }

  // Test 2: Supabase URL format
  try {
    new URL(SUPABASE_URL);
    console.log("✅ Supabase URL format: Valid");
  } catch {
    console.error("❌ Invalid Supabase URL format");
    showConnectionStatus("Invalid Supabase URL configuration", "error", 0);
    return false;
  }

  // Test 3: Supabase API accessibility
  try {
    const response = await fetch(SUPABASE_URL + "/rest/v1/", {
      method: "HEAD",
      headers: {
        apikey: SUPABASE_ANON_KEY,
      },
    });
    console.log("✅ Supabase API accessible:", response.status);
    return true;
  } catch (error) {
    console.error("❌ Cannot reach Supabase API:", error.message);
    showConnectionStatus(
      "Cannot connect to Supabase. Check if your project is active at supabase.com/dashboard",
      "error",
      0
    );
    return false;
  }
}

// ============================================================================
// SUPABASE INITIALIZATION
// ============================================================================
function initializeSupabase() {
  try {
    // Validation checks
    if (!SUPABASE_URL || !SUPABASE_URL.startsWith("https://")) {
      throw new Error("Invalid Supabase URL. Must start with https://");
    }

    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 20) {
      throw new Error("Invalid or missing Supabase API key");
    }

    if (!window.supabase) {
      throw new Error(
        "Supabase library not loaded. Check your internet connection and CDN availability."
      );
    }

    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    isSupabaseInitialized = true;
    console.log("✅ Supabase initialized successfully");
    console.log("📍 Connected to:", SUPABASE_URL);
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize Supabase:", error);
    showConnectionStatus(
      "Database initialization failed: " + error.message,
      "error",
      0
    );
    return false;
  }
}

// ============================================================================
// CONNECTION STATUS UI
// ============================================================================
function showConnectionStatus(message, type = "info", duration = 3000) {
  const statusDiv = document.getElementById("connectionStatus");
  if (!statusDiv) return;

  const icons = {
    info: "ℹ️",
    success: "✅",
    error: "❌",
    warning: "⚠️",
  };

  statusDiv.className = `connection-status ${type}`;
  statusDiv.innerHTML = `${icons[type] || "ℹ️"} ${message}`;
  statusDiv.classList.remove("hidden");

  if (duration > 0) {
    setTimeout(() => {
      statusDiv.classList.add("hidden");
    }, duration);
  }
}

function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) {
    loadingScreen.classList.add("hidden");
    setTimeout(() => loadingScreen.remove(), 500);
  }
}

// ============================================================================
// MAIN APPLICATION CLASS
// ============================================================================
class MediSecureApp {
  constructor() {
    this.currentSection = "signup";
    this.currentDashboardView = "dashboard";
    this.currentSession = null;
    this.hospitalData = null;
    this.verifiedPatient = null;
    this.autoSearchTimeout = null;
    this.connectionRetryCount = 0;
    this.maxRetries = 3;
    this.initializeApp();
  }

  async initializeApp() {
    console.log("🚀 Initializing MediSecure App...");
    showConnectionStatus("Initializing application...", "info", 0);

    // Check network first
    const networkOk = await checkNetworkConnectivity();
    if (!networkOk) {
      this.handleConnectionError();
      return;
    }

    // Initialize Supabase
    if (!initializeSupabase()) {
      this.handleConnectionError();
      return;
    }

    // Test database connection
    const connectionSuccess = await this.testDatabaseConnection();
    if (!connectionSuccess) {
      this.handleConnectionError();
      return;
    }

    this.initializeEventListeners();
    await this.checkExistingSession();
    showConnectionStatus("Application ready!", "success");
    hideLoadingScreen();
    console.log("✅ MediSecure App initialized successfully");
  }

  async testDatabaseConnection() {
    showConnectionStatus("Testing database connection...", "info", 0);

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout")), 10000)
      );

      const connectionPromise = supabase
        .from("hospitals")
        .select("hospital_id")
        .limit(1);

      const { data, error } = await Promise.race([
        connectionPromise,
        timeoutPromise,
      ]);

      if (error) {
        console.error("❌ Database connection failed:", error);
        this.handleSpecificError(error);
        return false;
      }

      console.log("✅ Database connection successful");
      showConnectionStatus("Database connected successfully!", "success");
      return true;
    } catch (error) {
      console.error("❌ Connection test error:", error);
      this.handleConnectionError(error);
      return false;
    }
  }

  handleSpecificError(error) {
    let message = "Database connection failed";

    if (error.message.includes("JWT") || error.message.includes("apikey")) {
      message = "Invalid API key. Check your Supabase credentials.";
    } else if (
      error.message.includes("not found") ||
      error.code === "PGRST116"
    ) {
      message = "Database tables not found. Please run the SQL schema first.";
    } else if (error.message.includes("timeout")) {
      message = "Connection timeout. Check your internet connection.";
    } else {
      message = `Database error: ${error.message}`;
    }

    showConnectionStatus(message, "error", 10000);
  }

  handleConnectionError(error) {
    this.connectionRetryCount++;

    if (this.connectionRetryCount <= this.maxRetries) {
      showConnectionStatus(
        `Connection failed. Retrying... (${this.connectionRetryCount}/${this.maxRetries})`,
        "warning",
        3000
      );
      setTimeout(() => this.testDatabaseConnection(), 3000);
    } else {
      showConnectionStatus(
        "Unable to connect. Please check: 1) Internet connection 2) Supabase project status 3) API credentials",
        "error",
        0
      );
      this.showOfflineMode();
    }
  }

  showOfflineMode() {
    this.showNotification(
      "Running in offline mode. Database features unavailable.",
      "error"
    );
    this.initializeEventListeners();
    hideLoadingScreen();
    this.showSignup();
  }

  async checkExistingSession() {
    const sessionData =
      localStorage.getItem("hospitalSession") ||
      sessionStorage.getItem("hospitalSession");

    if (sessionData) {
      try {
        this.currentSession = JSON.parse(sessionData);
        await this.showDashboard();
      } catch (error) {
        console.error("Error parsing session data:", error);
        localStorage.removeItem("hospitalSession");
        sessionStorage.removeItem("hospitalSession");
        this.showSignup();
      }
    } else {
      this.showSignup();
    }
  }

  checkDatabaseAvailability() {
    if (!isSupabaseInitialized) {
      this.showNotification(
        "Database connection not available. Please refresh the page.",
        "error"
      );
      return false;
    }
    return true;
  }

  initializeEventListeners() {
    // Signup form
    const verifyBtn = document.getElementById("verifyBtn");
    const signupForm = document.getElementById("signupForm");
    const togglePassword = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");

    if (verifyBtn)
      verifyBtn.addEventListener("click", () => this.verifyHospital());
    if (signupForm)
      signupForm.addEventListener("submit", (e) => this.handleSignup(e));
    if (togglePassword)
      togglePassword.addEventListener("click", () =>
        this.togglePasswordVisibility("password", "togglePassword")
      );
    if (passwordInput)
      passwordInput.addEventListener("input", () =>
        this.checkPasswordStrength()
      );
    if (confirmPasswordInput)
      confirmPasswordInput.addEventListener("input", () =>
        this.validatePasswordMatch()
      );

    // Login form
    const loginForm = document.getElementById("loginForm");
    const toggleLoginPassword = document.getElementById("toggleLoginPassword");
    const forgotPassword = document.getElementById("forgotPassword");

    if (loginForm)
      loginForm.addEventListener("submit", (e) => this.handleLogin(e));
    if (toggleLoginPassword)
      toggleLoginPassword.addEventListener("click", () =>
        this.togglePasswordVisibility("loginPassword", "toggleLoginPassword")
      );
    if (forgotPassword)
      forgotPassword.addEventListener("click", (e) =>
        this.handleForgotPassword(e)
      );

    // Dashboard
    const verifyPatientBtn = document.getElementById("verifyPatientBtn");
    const addRecordForm = document.getElementById("addRecordForm");
    const logoutBtn = document.getElementById("logoutBtn");
    const attachmentsInput = document.getElementById("attachments");

    if (verifyPatientBtn)
      verifyPatientBtn.addEventListener("click", () => this.verifyPatient());
    if (addRecordForm)
      addRecordForm.addEventListener("submit", (e) => this.handleAddRecord(e));
    if (logoutBtn)
      logoutBtn.addEventListener("click", () => this.handleLogout());
    if (attachmentsInput)
      attachmentsInput.addEventListener("change", (e) =>
        this.handleFileSelection(e)
      );

    // Auto-verify patient - CORRECTED: Removed patientName
    const patientIdInput = document.getElementById("patientId");
    const patientPhoneInput = document.getElementById("patientPhone");

    if (patientIdInput)
      patientIdInput.addEventListener("input", () => this.autoVerifyPatient());
    if (patientPhoneInput)
      patientPhoneInput.addEventListener("input", () =>
        this.autoVerifyPatient()
      );

    // Set minimum date for follow-up
    const followUpDate = document.getElementById("followUpDate");
    if (followUpDate) {
      followUpDate.min = new Date().toISOString().split("T")[0];
    }
  }

  // Navigation Methods
  showSignup() {
    this.hideAllSections();
    const signupSection = document.getElementById("signupSection");
    if (signupSection) signupSection.classList.remove("hidden");
    this.currentSection = "signup";
    this.resetForms();
  }

  showLogin() {
    this.hideAllSections();
    const loginSection = document.getElementById("loginSection");
    if (loginSection) loginSection.classList.remove("hidden");
    this.currentSection = "login";
    this.resetForms();
  }

  async showDashboard() {
    this.hideAllSections();
    const dashboardSection = document.getElementById("dashboardSection");
    if (dashboardSection) dashboardSection.classList.remove("hidden");
    this.currentSection = "dashboard";

    if (this.currentSession) {
      const hospitalName = document.getElementById("dashboardHospitalName");
      const hospitalId = document.getElementById("dashboardHospitalId");
      if (hospitalName)
        hospitalName.textContent = this.currentSession.hospitalName;
      if (hospitalId)
        hospitalId.textContent = `ID: ${this.currentSession.hospitalId}`;
      await this.loadDashboardStats();
    }

    this.resetForms();
    this.switchDashboardView("dashboard");
  }

  hideAllSections() {
    const sections = ["signupSection", "loginSection", "dashboardSection"];
    sections.forEach((sectionId) => {
      const section = document.getElementById(sectionId);
      if (section) section.classList.add("hidden");
    });
  }

  // Hospital Verification and Signup
  async verifyHospital() {
    if (!this.checkDatabaseAvailability()) return;

    const hospitalIdInput = document.getElementById("hospitalId");
    const licenseNumberInput = document.getElementById("licenseNumber");

    if (!hospitalIdInput || !licenseNumberInput) {
      this.showNotification(
        "Form elements not loaded. Please refresh.",
        "error"
      );
      return;
    }

    const hospitalId = hospitalIdInput.value.trim();
    const licenseNumber = licenseNumberInput.value.trim();

    if (!hospitalId || !licenseNumber) {
      this.showNotification(
        "Please enter both Hospital ID and License Number",
        "error"
      );
      return;
    }

    try {
      showConnectionStatus("Verifying hospital credentials...", "info", 0);

      const { data, error } = await supabase
        .from("hospitals")
        .select("*")
        .eq("hospital_id", hospitalId)
        .eq("license_number", licenseNumber)
        .single();

      if (error || !data) {
        this.showNotification("Invalid Hospital ID or License Number", "error");
        showConnectionStatus("Verification failed", "error");
        return;
      }

      this.hospitalData = data;
      this.showNotification("Hospital verified successfully!", "success");
      showConnectionStatus("Hospital verified!", "success");

      const verificationStep = document.getElementById("verificationStep");
      const registrationStep = document.getElementById("registrationStep");
      if (verificationStep) verificationStep.classList.add("hidden");
      if (registrationStep) registrationStep.classList.remove("hidden");

      const hospitalNameInput = document.getElementById("hospitalName");
      if (hospitalNameInput && data.name) {
        hospitalNameInput.value = data.name;
      }
    } catch (error) {
      console.error("Verification error:", error);
      this.showNotification("Verification failed. Please try again.", "error");
    }
  }

  async handleSignup(e) {
    e.preventDefault();
    if (!this.checkDatabaseAvailability()) return;

    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const adminEmail = document.getElementById("adminEmail").value;
    const contactPhone = document.getElementById("contactPhone").value;

    if (password !== confirmPassword) {
      this.showNotification("Passwords do not match!", "error");
      return;
    }

    if (!this.validatePasswordStrength(password)) {
      this.showNotification("Password does not meet requirements", "error");
      return;
    }

    try {
      const passwordHash = await this.hashPassword(password);

      const { error } = await supabase
        .from("hospitals")
        .update({
          password_hash: passwordHash,
          admin_email: adminEmail,
          contact_phone: contactPhone,
          is_verified: true,
        })
        .eq("hospital_id", this.hospitalData.hospital_id);

      if (error) throw error;

      this.showNotification(
        "Registration successful! Please login.",
        "success"
      );
      setTimeout(() => this.showLogin(), 2000);
    } catch (error) {
      console.error("Signup error:", error);
      this.showNotification("Registration failed: " + error.message, "error");
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    if (!this.checkDatabaseAvailability()) return;

    const hospitalId = document.getElementById("loginHospitalId").value;
    const password = document.getElementById("loginPassword").value;
    const rememberMe = document.getElementById("rememberMe").checked;

    try {
      const { data, error } = await supabase
        .from("hospitals")
        .select("*")
        .eq("hospital_id", hospitalId)
        .single();

      if (error || !data) {
        this.showNotification("Invalid Hospital ID or Password", "error");
        return;
      }

      const passwordMatch = await this.verifyPassword(
        password,
        data.password_hash
      );

      if (!passwordMatch) {
        this.showNotification("Invalid Hospital ID or Password", "error");
        return;
      }

      this.currentSession = {
        hospitalId: data.hospital_id,
        hospitalName: data.name,
        hospitalType: data.hospital_type,
        facilityCategory: data.facility_category || "",
        city: data.city,
        state: data.state,
      };

      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem("hospitalSession", JSON.stringify(this.currentSession));

      this.showNotification("Login successful!", "success");
      await this.showDashboard();
    } catch (error) {
      console.error("Login error:", error);
      this.showNotification("Login failed: " + error.message, "error");
    }
  }

  // Patient Verification - CORRECTED VERSION
  async verifyPatient() {
    if (!this.checkDatabaseAvailability()) return;

    const patientId = document.getElementById("patientId").value.trim();
    const patientPhone = document.getElementById("patientPhone").value.trim();

    // CORRECTED: Only validate Patient ID and Phone (removed name)
    if (!patientId || !patientPhone) {
      this.showNotification(
        "Please enter both Patient ID and Phone Number",
        "error"
      );
      return;
    }

    // Validate Patient ID format (should be exactly 12 digits)
    if (!/^\d{12}$/.test(patientId)) {
      this.showNotification(
        "Patient ID must be exactly 12 digits",
        "error"
      );
      return;
    }

    // Validate Phone format (should be 10 digits)
    if (!/^\d{10}$/.test(patientPhone)) {
      this.showNotification(
        "Phone number must be exactly 10 digits",
        "error"
      );
      return;
    }

    try {
      // CORRECTED: Query without name field - exact matches only
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("patient_id", patientId)
        .eq("phone", patientPhone)
        .single();

      if (error || !data) {
        this.showNotification(
          "Patient not found. Please verify Patient ID and Phone Number.",
          "error"
        );
        this.verifiedPatient = null;
        this.updatePatientVerificationUI(false);
        return;
      }

      this.verifiedPatient = data;
      this.showNotification("Patient verified successfully!", "success");
      this.updatePatientVerificationUI(true, data);

      const recordFormSection = document.getElementById("recordFormSection");
      if (recordFormSection) recordFormSection.classList.remove("hidden");
    } catch (error) {
      console.error("Patient verification error:", error);
      this.showNotification("Verification failed: " + error.message, "error");
    }
  }

  // CORRECTED: Auto-verify without name field
  autoVerifyPatient() {
    clearTimeout(this.autoSearchTimeout);
    
    const patientId = document.getElementById("patientId")?.value.trim();
    const patientPhone = document.getElementById("patientPhone")?.value.trim();

    // CORRECTED: Only proceed if both ID and Phone are complete
    // Patient ID should be 12 digits, Phone should be 10 digits
    if (patientId && patientPhone && 
        patientId.length === 12 && 
        patientPhone.length === 10) {
      this.autoSearchTimeout = setTimeout(() => {
        this.verifyPatient();
      }, 1000);
    } else {
      // Clear verification if incomplete
      this.verifiedPatient = null;
      this.updatePatientVerificationUI(false);
      const recordFormSection = document.getElementById("recordFormSection");
      if (recordFormSection) recordFormSection.classList.add("hidden");
    }
  }

  updatePatientVerificationUI(isVerified, patientData = null) {
    const verificationStatus = document.getElementById("verificationStatus");
    const patientInfo = document.getElementById("patientInfo");

    if (!verificationStatus || !patientInfo) return;

    if (isVerified && patientData) {
      verificationStatus.className = "verification-status success";
      verificationStatus.innerHTML = `✓ Patient Verified`;

      const age = this.calculateAge(patientData.date_of_birth);
      patientInfo.innerHTML = `
        <p><strong>Name:</strong> ${patientData.name}</p>
        <p><strong>ABHA:</strong> ${
          patientData.abha_number || "Not provided"
        }</p>
        <p><strong>Age:</strong> ${age} years | <strong>Gender:</strong> ${
        patientData.gender
      }</p>
        <p><strong>Blood Group:</strong> ${
          patientData.blood_group || "N/A"
        }</p>
        <p><strong>Phone:</strong> ${patientData.phone}</p>
      `;
    } else {
      verificationStatus.className = "verification-status";
      verificationStatus.innerHTML = `⚠ Patient Not Verified`;
      patientInfo.innerHTML = `<p>Enter Patient ID and Phone Number to verify</p>`;
    }
  }

  calculateAge(dateOfBirth) {
    if (!dateOfBirth) return "N/A";
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  }

  // Medical Record Management
  async handleAddRecord(e) {
    e.preventDefault();
    if (!this.checkDatabaseAvailability()) return;

    if (!this.verifiedPatient) {
      this.showNotification("Please verify patient first", "error");
      return;
    }

    const recordData = {
      patient_id: this.verifiedPatient.patient_id,
      hospital_id: this.currentSession.hospitalId,
      visit_date: document.getElementById("visitDate").value,
      doctor_name: document.getElementById("doctorName").value,
      department: document.getElementById("department").value,
      chief_complaint: document.getElementById("chiefComplaint").value,
      vital_signs: document.getElementById("vitalSigns").value,
      provisional_diagnosis: document.getElementById("provisionalDiagnosis")
        .value,
      final_diagnosis: document.getElementById("finalDiagnosis").value,
      treatment_plan: document.getElementById("treatmentPlan").value,
      medications_prescribed: document.getElementById("medications").value,
      lab_tests: document.getElementById("labTests").value,
      follow_up_date: document.getElementById("followUpDate").value || null,
      follow_up_instructions: document.getElementById("followUpInstructions")
        .value,
      additional_notes: document.getElementById("additionalNotes").value,
      record_status: "active",
    };

    try {
      const { data, error } = await supabase
        .from("medical_records")
        .insert([recordData])
        .select();

      if (error) throw error;

      this.showNotification("Medical record added successfully!", "success");
      document.getElementById("addRecordForm").reset();
      this.verifiedPatient = null;
      this.updatePatientVerificationUI(false);
      document.getElementById("recordFormSection").classList.add("hidden");
      await this.loadDashboardStats();
      this.switchDashboardView("records");
    } catch (error) {
      console.error("Error adding record:", error);
      this.showNotification(
        "Failed to add record: " + error.message,
        "error"
      );
    }
  }

  async loadDashboardStats() {
    if (!this.checkDatabaseAvailability()) return;

    try {
      const { data: records, error } = await supabase
        .from("medical_records")
        .select("*")
        .eq("hospital_id", this.currentSession.hospitalId);

      if (error) throw error;

      const totalRecords = records.length;
      const activeRecords = records.filter(
        (r) => r.record_status === "active"
      ).length;

      document.getElementById("totalRecords").textContent = totalRecords;
      document.getElementById("activeRecords").textContent = activeRecords;

      // Get unique patients
      const uniquePatients = new Set(records.map((r) => r.patient_id)).size;
      document.getElementById("totalPatients").textContent = uniquePatients;
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }

  async loadMedicalRecords() {
    if (!this.checkDatabaseAvailability()) return;

    try {
      const { data: records, error } = await supabase
        .from("medical_records")
        .select(
          `
          *,
          patients (name, abha_number)
        `
        )
        .eq("hospital_id", this.currentSession.hospitalId)
        .order("visit_date", { ascending: false });

      if (error) throw error;

      const recordsList = document.getElementById("recordsList");
      if (!recordsList) return;

      if (records.length === 0) {
        recordsList.innerHTML = `
          <div class="empty-state">
            <p>No medical records found</p>
            <p class="text-muted">Start by adding a new record</p>
          </div>
        `;
        return;
      }

      recordsList.innerHTML = records
        .map(
          (record) => `
        <div class="record-card">
          <div class="record-header">
            <h3>Record #${record.record_number}</h3>
            <span class="record-status ${record.record_status}">${
            record.record_status
          }</span>
          </div>
          <div class="record-body">
            <p><strong>Patient:</strong> ${record.patients?.name || "N/A"}</p>
            <p><strong>ABHA:</strong> ${
              record.patients?.abha_number || "Not provided"
            }</p>
            <p><strong>Visit Date:</strong> ${new Date(
              record.visit_date
            ).toLocaleDateString()}</p>
            <p><strong>Chief Complaint:</strong> ${record.chief_complaint}</p>
            <p><strong>Diagnosis:</strong> ${
              record.provisional_diagnosis || "N/A"
            }</p>
            <p><strong>Doctor:</strong> ${record.doctor_name}</p>
          </div>
          <div class="record-footer">
            <button onclick="app.viewRecordDetails('${
              record.record_id
            }')" class="btn btn-secondary btn-sm">
              View Details
            </button>
          </div>
        </div>
      `
        )
        .join("");
    } catch (error) {
      console.error("Error loading records:", error);
      this.showNotification("Failed to load records", "error");
    }
  }

  async viewRecordDetails(recordId) {
    // Implementation for viewing full record details
    console.log("Viewing record:", recordId);
    this.showNotification("View details feature coming soon", "info");
  }

  switchDashboardView(view) {
    this.currentDashboardView = view;

    // Hide all views
    const views = ["dashboardHome", "addRecordView", "recordsView"];
    views.forEach((viewId) => {
      const element = document.getElementById(viewId);
      if (element) element.classList.add("hidden");
    });

    // Show selected view
    const viewMap = {
      dashboard: "dashboardHome",
      addRecord: "addRecordView",
      records: "recordsView",
    };

    const selectedView = document.getElementById(viewMap[view]);
    if (selectedView) selectedView.classList.remove("hidden");

    // Update nav buttons
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    const activeBtn = document.querySelector(`[onclick*="${view}"]`);
    if (activeBtn) activeBtn.classList.add("active");

    // Load data if needed
    if (view === "records") {
      this.loadMedicalRecords();
    }
  }

  handleFileSelection(e) {
    const files = e.target.files;
    const fileList = document.getElementById("selectedFiles");

    if (fileList) {
      fileList.innerHTML = "";
      Array.from(files).forEach((file) => {
        const fileItem = document.createElement("div");
        fileItem.className = "file-item";
        fileItem.textContent = `${file.name} (${(file.size / 1024).toFixed(
          2
        )} KB)`;
        fileList.appendChild(fileItem);
      });
    }
  }

  // Utility Methods
  togglePasswordVisibility(inputId, buttonId) {
    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);

    if (input && button) {
      if (input.type === "password") {
        input.type = "text";
        button.textContent = "🙈";
      } else {
        input.type = "password";
        button.textContent = "👁️";
      }
    }
  }

  checkPasswordStrength() {
    const password = document.getElementById("password").value;
    const strengthBar = document.getElementById("passwordStrength");

    if (!strengthBar) return;

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;

    const strengthLevels = ["weak", "fair", "good", "strong"];
    strengthBar.className = `password-strength ${strengthLevels[strength]}`;
  }

  validatePasswordMatch() {
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const matchIndicator = document.getElementById("passwordMatch");

    if (!matchIndicator) return;

    if (confirmPassword === "") {
      matchIndicator.textContent = "";
      return;
    }

    if (password === confirmPassword) {
      matchIndicator.textContent = "✓ Passwords match";
      matchIndicator.style.color = "#28a745";
    } else {
      matchIndicator.textContent = "✗ Passwords do not match";
      matchIndicator.style.color = "#dc3545";
    }
  }

  validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return (
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers &&
      hasSpecialChar
    );
  }

  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async verifyPassword(password, hash) {
    const passwordHash = await this.hashPassword(password);
    return passwordHash === hash;
  }

  handleForgotPassword(e) {
    e.preventDefault();
    this.showNotification(
      "Password reset feature coming soon. Contact admin.",
      "info"
    );
  }

  handleLogout() {
    localStorage.removeItem("hospitalSession");
    sessionStorage.removeItem("hospitalSession");
    this.currentSession = null;
    this.hospitalData = null;
    this.verifiedPatient = null;
    this.showNotification("Logged out successfully", "success");
    this.showLogin();
  }

  resetForms() {
    const forms = document.querySelectorAll("form");
    forms.forEach((form) => form.reset());

    // Reset verification UI
    const verificationStep = document.getElementById("verificationStep");
    const registrationStep = document.getElementById("registrationStep");
    if (verificationStep) verificationStep.classList.remove("hidden");
    if (registrationStep) registrationStep.classList.add("hidden");

    // Reset patient verification
    this.verifiedPatient = null;
    this.updatePatientVerificationUI(false);
    const recordFormSection = document.getElementById("recordFormSection");
    if (recordFormSection) recordFormSection.classList.add("hidden");
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add("show");
    }, 100);

    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Initialize app when DOM is ready
let app;
document.addEventListener("DOMContentLoaded", () => {
  app = new MediSecureApp();
});

// Navigation functions (called from HTML)
function showSignup() {
  if (app) app.showSignup();
}

function showLogin() {
  if (app) app.showLogin();
}

function switchView(view) {
  if (app) app.switchDashboardView(view);
}
