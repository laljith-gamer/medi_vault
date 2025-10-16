const SUPABASE_URL = "https://ebqyefcjvrfhpmqkuaud.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVicXllZmNqdnJmaHBtcWt1YXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MzU1MzUsImV4cCI6MjA3NjAxMTUzNX0.PP5OqeeWFKAlclm6aFPEKv7s3NeExjuO5fLp2VEikOo";

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

  try {
    new URL(SUPABASE_URL);
    console.log("✅ Supabase URL format: Valid");
  } catch {
    console.error("❌ Invalid Supabase URL format");
    showConnectionStatus("Invalid Supabase URL configuration", "error", 0);
    return false;
  }

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

    const networkOk = await checkNetworkConnectivity();
    if (!networkOk) {
      this.handleConnectionError();
      return;
    }

    if (!initializeSupabase()) {
      this.handleConnectionError();
      return;
    }

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

    // Navigation links
    const showLogin = document.getElementById("showLogin");
    const showSignup = document.getElementById("showSignup");

    if (showLogin)
      showLogin.addEventListener("click", (e) => {
        e.preventDefault();
        this.showLogin();
      });
    if (showSignup)
      showSignup.addEventListener("click", (e) => {
        e.preventDefault();
        this.showSignup();
      });

    // Dashboard navigation
    const showDashboardView = document.getElementById("showDashboardView");
    const showAddRecordView = document.getElementById("showAddRecordView");
    const logoutBtn = document.getElementById("logoutBtn");

    if (showDashboardView)
      showDashboardView.addEventListener("click", () =>
        this.switchDashboardView("dashboard")
      );
    if (showAddRecordView)
      showAddRecordView.addEventListener("click", () =>
        this.switchDashboardView("addRecord")
      );
    if (logoutBtn)
      logoutBtn.addEventListener("click", () => this.handleLogout());

    // Patient verification
    const verifyPatientBtn = document.getElementById("verifyPatientBtn");
    const patientIdInput = document.getElementById("patientId");
    const patientPhoneInput = document.getElementById("patientPhone");

    if (verifyPatientBtn)
      verifyPatientBtn.addEventListener("click", () => this.verifyPatient());
    if (patientIdInput)
      patientIdInput.addEventListener("input", () => this.autoVerifyPatient());
    if (patientPhoneInput)
      patientPhoneInput.addEventListener("input", () =>
        this.autoVerifyPatient()
      );

    // Patient registration buttons
    const registerNewPatientBtn = document.getElementById(
      "registerNewPatientBtn"
    );
    const cancelNewPatient = document.getElementById("cancelNewPatient");
    const patientRegistrationForm = document.getElementById(
      "patientRegistrationForm"
    );

    if (registerNewPatientBtn)
      registerNewPatientBtn.addEventListener("click", () =>
        this.showNewPatientForm()
      );
    if (cancelNewPatient)
      cancelNewPatient.addEventListener("click", () =>
        this.hideNewPatientForm()
      );
    if (patientRegistrationForm)
      patientRegistrationForm.addEventListener("submit", (e) =>
        this.handleNewPatientRegistration(e)
      );

    // Medical record form
    const addRecordForm = document.getElementById("addRecordForm");
    const cancelRecord = document.getElementById("cancelRecord");

    if (addRecordForm)
      addRecordForm.addEventListener("submit", (e) => this.handleAddRecord(e));
    if (cancelRecord)
      cancelRecord.addEventListener("click", () => this.resetAddRecordView());

    // Set today's date
    const visitDate = document.getElementById("visitDate");
    const followUpDate = document.getElementById("followUpDate");
    const today = new Date().toISOString().split("T")[0];

    if (visitDate) {
      visitDate.value = today;
      visitDate.max = today;
    }
    if (followUpDate) {
      followUpDate.min = today;
    }

    // Set current time
    const visitTime = document.getElementById("visitTime");
    if (visitTime) {
      const now = new Date();
      visitTime.value = now.toTimeString().slice(0, 5);
    }

    // Phone number validation - numbers only
    this.setupPhoneValidation();
  }

  setupPhoneValidation() {
    const phoneInputs = [
      "contactPhone",
      "patientPhone",
      "emergencyContactPhone",
    ];

    phoneInputs.forEach((inputId) => {
      const input = document.getElementById(inputId);
      if (input) {
        input.addEventListener("input", (e) => {
          e.target.value = e.target.value.replace(/[^0-9]/g, "");
        });
      }
    });
  }

  // ========================================================================
  // NAVIGATION METHODS
  // ========================================================================

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
      await this.loadMedicalRecords();
    }

    this.switchDashboardView("dashboard");
  }

  hideAllSections() {
    const sections = ["signupSection", "loginSection", "dashboardSection"];
    sections.forEach((sectionId) => {
      const section = document.getElementById(sectionId);
      if (section) section.classList.add("hidden");
    });
  }

  switchDashboardView(view) {
    const dashboardView = document.getElementById("dashboardView");
    const addRecordView = document.getElementById("addRecordView");

    if (view === "dashboard") {
      if (dashboardView) dashboardView.classList.remove("hidden");
      if (addRecordView) addRecordView.classList.add("hidden");
      this.loadMedicalRecords();
    } else if (view === "addRecord") {
      if (dashboardView) dashboardView.classList.add("hidden");
      if (addRecordView) addRecordView.classList.remove("hidden");
      this.resetAddRecordView();
    }

    this.currentDashboardView = view;
  }

  resetForms() {
    const forms = document.querySelectorAll("form");
    forms.forEach((form) => form.reset());
  }

  resetAddRecordView() {
    this.verifiedPatient = null;
    this.updatePatientVerificationUI(false);

    const recordFormSection = document.getElementById("recordFormSection");
    const newPatientForm = document.getElementById("newPatientForm");
    const newPatientPrompt = document.getElementById("newPatientPrompt");

    if (recordFormSection) recordFormSection.classList.add("hidden");
    if (newPatientForm) newPatientForm.classList.add("hidden");
    if (newPatientPrompt) newPatientPrompt.classList.add("hidden");

    const addRecordForm = document.getElementById("addRecordForm");
    if (addRecordForm) addRecordForm.reset();

    const patientId = document.getElementById("patientId");
    const patientPhone = document.getElementById("patientPhone");
    if (patientId) patientId.value = "";
    if (patientPhone) patientPhone.value = "";
  }

  // ========================================================================
  // HOSPITAL VERIFICATION AND SIGNUP
  // ========================================================================

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

    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const adminEmailInput = document.getElementById("adminEmail");
    const countryCodeInput = document.getElementById("countryCode");
    const contactPhoneInput = document.getElementById("contactPhone");

    // Check if all required elements exist
    if (
      !passwordInput ||
      !confirmPasswordInput ||
      !adminEmailInput ||
      !countryCodeInput ||
      !contactPhoneInput
    ) {
      console.error("Form elements not found:", {
        password: !!passwordInput,
        confirmPassword: !!confirmPasswordInput,
        adminEmail: !!adminEmailInput,
        countryCode: !!countryCodeInput,
        contactPhone: !!contactPhoneInput,
      });
      this.showNotification(
        "Form initialization error. Please refresh the page.",
        "error"
      );
      return;
    }

    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const adminEmail = adminEmailInput.value;
    const countryCode = countryCodeInput.value;
    const contactPhone = contactPhoneInput.value;

    if (password !== confirmPassword) {
      this.showNotification("Passwords do not match!", "error");
      return;
    }

    if (!this.validatePasswordStrength(password)) {
      this.showNotification("Password does not meet requirements", "error");
      return;
    }

    // Validate phone number (should be 10 digits)
    if (!/^\d{10}$/.test(contactPhone)) {
      this.showNotification(
        "Please enter a valid 10-digit phone number",
        "error"
      );
      return;
    }

    // Combine country code with phone number
    const fullPhone = countryCode + contactPhone;

    try {
      const passwordHash = await this.hashPassword(password);

      const { error } = await supabase
        .from("hospitals")
        .update({
          password_hash: passwordHash,
          admin_email: adminEmail,
          contact_phone: fullPhone,
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

  // ========================================================================
  // LOGIN
  // ========================================================================

  async handleLogin(e) {
    e.preventDefault();
    if (!this.checkDatabaseAvailability()) return;

    const hospitalId = document.getElementById("loginHospitalId").value.trim();
    const password = document.getElementById("loginPassword").value;
    const rememberMe = document.getElementById("rememberMe").checked;

    if (!hospitalId || !password) {
      this.showNotification(
        "Please enter both Hospital ID and Password",
        "error"
      );
      return;
    }

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

  handleLogout() {
    localStorage.removeItem("hospitalSession");
    sessionStorage.removeItem("hospitalSession");
    this.currentSession = null;
    this.hospitalData = null;
    this.verifiedPatient = null;
    this.showNotification("Logged out successfully", "success");
    this.showLogin();
  }

  handleForgotPassword(e) {
    e.preventDefault();
    this.showNotification(
      "Please contact your hospital administrator for password reset",
      "info"
    );
  }

  // ========================================================================
  // PATIENT VERIFICATION
  // ========================================================================

  async verifyPatient() {
    if (!this.checkDatabaseAvailability()) return;

    const patientId = document.getElementById("patientId").value.trim();
    const patientPhone = document.getElementById("patientPhone").value.trim();

    if (!patientId || !patientPhone) {
      this.showNotification(
        "Please enter both ABHA Number and Phone Number",
        "error"
      );
      return;
    }

    if (!/^\d{14}$/.test(patientId)) {
      this.showNotification("ABHA Number must be exactly 14 digits", "error");
      return;
    }

    if (!/^\d{10}$/.test(patientPhone)) {
      this.showNotification("Phone number must be exactly 10 digits", "error");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("abha_number", patientId)
        .eq("phone", `+91${patientPhone}`)
        .single();

      if (error || !data) {
        this.showNotification("Patient not found in system", "warning");
        this.verifiedPatient = null;
        this.updatePatientVerificationUI(false);

        const newPatientPrompt = document.getElementById("newPatientPrompt");
        if (newPatientPrompt) newPatientPrompt.classList.remove("hidden");

        const recordFormSection = document.getElementById("recordFormSection");
        if (recordFormSection) recordFormSection.classList.add("hidden");

        return;
      }

      this.verifiedPatient = data;
      this.showNotification("Patient verified successfully!", "success");
      this.updatePatientVerificationUI(true, data);

      const newPatientPrompt = document.getElementById("newPatientPrompt");
      if (newPatientPrompt) newPatientPrompt.classList.add("hidden");

      const recordFormSection = document.getElementById("recordFormSection");
      if (recordFormSection) recordFormSection.classList.remove("hidden");
    } catch (error) {
      console.error("Patient verification error:", error);
      this.showNotification("Verification failed: " + error.message, "error");
    }
  }

  autoVerifyPatient() {
    clearTimeout(this.autoSearchTimeout);

    const patientId = document.getElementById("patientId")?.value.trim();
    const patientPhone = document.getElementById("patientPhone")?.value.trim();

    if (
      patientId &&
      patientPhone &&
      patientId.length === 14 &&
      patientPhone.length === 10
    ) {
      this.autoSearchTimeout = setTimeout(() => {
        this.verifyPatient();
      }, 1000);
    } else {
      this.verifiedPatient = null;
      this.updatePatientVerificationUI(false);

      const recordFormSection = document.getElementById("recordFormSection");
      const newPatientPrompt = document.getElementById("newPatientPrompt");

      if (recordFormSection) recordFormSection.classList.add("hidden");
      if (newPatientPrompt) newPatientPrompt.classList.add("hidden");
    }
  }

  updatePatientVerificationUI(isVerified, patientData = null) {
    const verificationStatus = document.getElementById("verificationStatus");
    const patientInfo = document.getElementById("patientInfo");

    if (!verificationStatus || !patientInfo) return;

    if (isVerified && patientData) {
      verificationStatus.className = "verification-status success";
      verificationStatus.innerHTML = `✅ Patient Verified`;

      const age = this.calculateAge(patientData.date_of_birth);

      patientInfo.classList.remove("hidden");
      patientInfo.innerHTML = `
                <div class="patient-details">
                    <h4>Patient Information</h4>
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
                </div>
            `;
    } else {
      verificationStatus.className = "verification-status error";
      verificationStatus.innerHTML = `⚠️ Patient Not Verified`;

      patientInfo.classList.add("hidden");
      patientInfo.innerHTML = `
                <div class="patient-details">
                    <h4>Patient Information</h4>
                    <p>Enter ABHA Number and Phone Number to verify</p>
                </div>
            `;
    }
  }

  // ========================================================================
  // NEW PATIENT REGISTRATION
  // ========================================================================

  showNewPatientForm() {
    const newPatientForm = document.getElementById("newPatientForm");
    const newPatientPrompt = document.getElementById("newPatientPrompt");

    if (newPatientForm) newPatientForm.classList.remove("hidden");
    if (newPatientPrompt) newPatientPrompt.classList.add("hidden");

    const verificationPhone = document
      .getElementById("patientPhone")
      .value.trim();
    const newPatientPhone = document.getElementById("newPatientPhone");

    if (newPatientPhone && verificationPhone) {
      newPatientPhone.value = `+91${verificationPhone}`;
    }

    newPatientForm?.scrollIntoView({ behavior: "smooth" });
  }

  hideNewPatientForm() {
    const newPatientForm = document.getElementById("newPatientForm");
    const newPatientPrompt = document.getElementById("newPatientPrompt");

    if (newPatientForm) newPatientForm.classList.add("hidden");
    if (newPatientPrompt) newPatientPrompt.classList.remove("hidden");

    const patientRegistrationForm = document.getElementById(
      "patientRegistrationForm"
    );
    if (patientRegistrationForm) patientRegistrationForm.reset();
  }

  async handleNewPatientRegistration(e) {
    e.preventDefault();
    if (!this.checkDatabaseAvailability()) return;

    const patientId = this.generatePatientId();
    const abhaNumber = document.getElementById("patientId").value.trim();
    const phone = document.getElementById("newPatientPhone").value.trim();

    const patientData = {
      patient_id: patientId,
      abha_number: abhaNumber,
      name: document.getElementById("newPatientName").value.trim(),
      phone: phone,
      email: document.getElementById("newPatientEmail").value.trim() || null,
      date_of_birth: document.getElementById("newPatientDOB").value,
      gender: document.getElementById("newPatientGender").value,
      blood_group:
        document.getElementById("newPatientBloodGroup").value || null,
      address_line1:
        document.getElementById("newPatientAddress").value.trim() || null,
      city: document.getElementById("newPatientCity").value.trim() || null,
      state: document.getElementById("newPatientState").value.trim() || null,
      pincode:
        document.getElementById("newPatientPincode").value.trim() || null,
      emergency_contact_name:
        document.getElementById("emergencyContactName").value.trim() || null,
      emergency_contact_phone: this.getFullPhoneNumber(
        "emergencyCountryCode",
        "emergencyContactPhone"
      ),
      emergency_contact_relation:
        document.getElementById("emergencyContactRelation").value.trim() ||
        null,
      consent_data_sharing: true,
      consent_date: new Date().toISOString(),
      is_active: true,
    };

    try {
      const { data, error } = await supabase
        .from("patients")
        .insert([patientData])
        .select()
        .single();

      if (error) throw error;

      this.showNotification("Patient registered successfully!", "success");

      this.verifiedPatient = data;
      this.updatePatientVerificationUI(true, data);

      this.hideNewPatientForm();

      const recordFormSection = document.getElementById("recordFormSection");
      if (recordFormSection) recordFormSection.classList.remove("hidden");
    } catch (error) {
      console.error("Patient registration error:", error);
      this.showNotification(
        "Failed to register patient: " + error.message,
        "error"
      );
    }
  }

  getFullPhoneNumber(countryCodeId, phoneId) {
    const countryCode = document.getElementById(countryCodeId)?.value || "+91";
    const phone = document.getElementById(phoneId)?.value.trim();
    return phone ? countryCode + phone : null;
  }

  generatePatientId() {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `PAT-${year}-${timestamp}${random}`;
  }

  // ========================================================================
  // MEDICAL RECORD MANAGEMENT
  // ========================================================================

  async handleAddRecord(e) {
    e.preventDefault();
    if (!this.checkDatabaseAvailability()) return;

    if (!this.verifiedPatient) {
      this.showNotification("Please verify patient first", "error");
      return;
    }

    const recordNumber = this.generateRecordNumber();

    const canEditUntil = new Date();
    canEditUntil.setHours(canEditUntil.getHours() + 48);

    const vitalSigns = {
      bp: document.getElementById("bloodPressure")?.value || null,
      pulse: document.getElementById("pulse")?.value || null,
      temp: document.getElementById("temperature")?.value || null,
      rr: document.getElementById("respiratoryRate")?.value || null,
      spo2: document.getElementById("spo2")?.value || null,
      weight: document.getElementById("weight")?.value || null,
    };

    const recordData = {
      record_number: recordNumber,
      patient_id: this.verifiedPatient.patient_id,
      hospital_id: this.currentSession.hospitalId,
      visit_date: document.getElementById("visitDate").value,
      visit_time: document.getElementById("visitTime").value,
      visit_type: document.getElementById("visitType").value,
      record_type: "OPD Consultation",
      doctor_name: document.getElementById("doctorName").value,
      doctor_registration_number:
        document.getElementById("doctorRegistration").value,
      doctor_qualification: document.getElementById("doctorQualification")
        .value,
      doctor_specialization:
        document.getElementById("doctorSpecialization").value || null,
      chief_complaint: document.getElementById("chiefComplaint").value,
      complaint_duration:
        document.getElementById("complaintDuration").value || null,
      history_of_present_illness:
        document.getElementById("presentIllness").value || null,
      vital_signs: vitalSigns,
      clinical_examination:
        document.getElementById("clinicalExamination").value || null,
      provisional_diagnosis: document.getElementById("provisionalDiagnosis")
        .value,
      final_diagnosis: document.getElementById("finalDiagnosis").value || null,
      icd10_code: document.getElementById("icd10Code").value || null,
      severity: document.getElementById("severity").value || "Medium",
      treatment_plan: document.getElementById("treatmentPlan").value || null,
      medications:
        document.getElementById("medicationsPrescribed").value || null,
      investigations_ordered:
        document.getElementById("investigationsOrdered").value || null,
      follow_up_date: document.getElementById("followUpDate").value || null,
      follow_up_instructions:
        document.getElementById("followUpInstructions").value || null,
      lifestyle_modifications:
        document.getElementById("lifestyleAdvice").value || null,
      notes: document.getElementById("additionalNotes").value || null,
      can_edit_until: canEditUntil.toISOString(),
      is_editable: true,
    };

    try {
      const { data, error } = await supabase
        .from("medical_records")
        .insert([recordData])
        .select();

      if (error) throw error;

      this.showNotification("Medical record added successfully!", "success");

      this.resetAddRecordView();
      await this.loadDashboardStats();
      this.switchDashboardView("dashboard");
    } catch (error) {
      console.error("Error adding record:", error);
      this.showNotification("Failed to add record: " + error.message, "error");
    }
  }

  generateRecordNumber() {
    const hospitalId = this.currentSession.hospitalId.split("-")[0];
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-8);
    return `REC-${hospitalId}-${year}-${timestamp}`;
  }

  // ========================================================================
  // DASHBOARD STATS AND RECORDS
  // ========================================================================

  async loadDashboardStats() {
    if (!this.checkDatabaseAvailability()) return;

    try {
      const { data: records, error } = await supabase
        .from("medical_records")
        .select("*")
        .eq("hospital_id", this.currentSession.hospitalId);

      if (error) throw error;

      const totalRecords = records.length;
      const activeRecords = records.filter((r) => r.is_editable).length;

      document.getElementById("totalRecords").textContent = totalRecords;
      document.getElementById("activeRecords").textContent = activeRecords;

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
                    patients (
                        name,
                        abha_number,
                        phone
                    )
                `
        )
        .eq("hospital_id", this.currentSession.hospitalId)
        .order("visit_date", { ascending: false })
        .limit(10);

      if (error) throw error;

      const recordsList = document.getElementById("recordsList");
      if (!recordsList) return;

      if (records.length === 0) {
        recordsList.innerHTML = `
                    <div class="empty-state">
                        <p>No medical records found</p>
                        <p style="font-size: 0.9rem; color: var(--gray-500);">Start by adding a new record</p>
                    </div>
                `;
        return;
      }

      recordsList.innerHTML = records
        .map(
          (record) => `
                <div class="record-card">
                    <div class="record-header">
                        <h4>${record.record_number}</h4>
                        <span class="badge ${record.severity.toLowerCase()}">${
            record.severity
          }</span>
                    </div>
                    <div class="record-details">
                        <p><strong>Patient:</strong> ${
                          record.patients?.name || "N/A"
                        }</p>
                        <p><strong>ABHA:</strong> ${
                          record.patients?.abha_number || "Not provided"
                        }</p>
                        <p><strong>Visit Date:</strong> ${new Date(
                          record.visit_date
                        ).toLocaleDateString()}</p>
                        <p><strong>Visit Type:</strong> ${record.visit_type}</p>
                        <p><strong>Chief Complaint:</strong> ${
                          record.chief_complaint
                        }</p>
                        <p><strong>Diagnosis:</strong> ${
                          record.provisional_diagnosis || "N/A"
                        }</p>
                        <p><strong>Doctor:</strong> ${record.doctor_name}</p>
                    </div>
                </div>
            `
        )
        .join("");
    } catch (error) {
      console.error("Error loading records:", error);
      const recordsList = document.getElementById("recordsList");
      if (recordsList) {
        recordsList.innerHTML = `
                    <div class="empty-state">
                        <p style="color: var(--danger-color);">Error loading records</p>
                    </div>
                `;
      }
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

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
    const strengthDiv = document.getElementById("passwordStrength");

    if (!strengthDiv) return;

    let strength = 0;
    let feedback = "";

    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;

    if (password.length === 0) {
      strengthDiv.className = "password-strength";
      strengthDiv.textContent = "";
    } else if (strength <= 2) {
      strengthDiv.className = "password-strength weak";
      feedback = "Weak - Add uppercase, numbers, and symbols";
    } else if (strength === 3) {
      strengthDiv.className = "password-strength fair";
      feedback = "Fair - Add more characters and symbols";
    } else if (strength === 4) {
      strengthDiv.className = "password-strength good";
      feedback = "Good - Consider adding special characters";
    } else {
      strengthDiv.className = "password-strength strong";
      feedback = "Strong - Excellent password!";
    }

    strengthDiv.textContent = feedback;
  }

  validatePasswordStrength(password) {
    return (
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password)
    );
  }

  validatePasswordMatch() {
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const matchDiv = document.getElementById("passwordMatch");

    if (!matchDiv || !confirmPassword) return;

    if (password === confirmPassword) {
      matchDiv.style.color = "var(--success-color)";
      matchDiv.textContent = "✓ Passwords match";
    } else {
      matchDiv.style.color = "var(--danger-color)";
      matchDiv.textContent = "✗ Passwords do not match";
    }
  }

  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async verifyPassword(password, storedHash) {
    const inputHash = await this.hashPassword(password);
    return inputHash === storedHash;
  }

  showNotification(message, type = "info") {
    const notification = document.getElementById("notification");
    if (!notification) return;

    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.classList.add("show");

    setTimeout(() => {
      notification.classList.remove("show");
    }, 4000);
  }
}

// ============================================================================
// INITIALIZE APP
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  new MediSecureApp();
});
