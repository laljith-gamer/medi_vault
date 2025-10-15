// ============================================================================
// MEDIVAULT - Complete Application JavaScript (CORRECTED)
// Healthcare Record Management System - Supabase Integration
// Version: 2.1 | Date: October 2025
// ============================================================================

// Supabase Configuration - Update with your Supabase credentials
const SUPABASE_URL = https:"https://uqozcnbbbkrsecfiecme.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxb3pjbmJiYmtyc2VjZmllY21lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNjc1MzksImV4cCI6MjA3NTk0MzUzOX0.uDT17azQATeozQeZDzWRBRMgHBVgko9VZB2vLUbLXD4";

// Initialize Supabase with comprehensive error handling
let supabase;
let isSupabaseInitialized = false;

function initializeSupabase() {
    try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error("Please update Supabase credentials in app.js");
        }
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        isSupabaseInitialized = true;
        console.log("✅ Supabase initialized successfully");
        return true;
    } catch (error) {
        console.error("❌ Failed to initialize Supabase:", error);
        showConnectionStatus("Failed to initialize database connection", "error");
        return false;
    }
}

// Connection status indicator
function showConnectionStatus(message, type = "info", duration = 3000) {
    const statusDiv = document.getElementById("connectionStatus");
    if (!statusDiv) return;

    statusDiv.className = `connection-status ${type}`;
    statusDiv.innerHTML = `${message}`;
    statusDiv.classList.remove("hidden");

    if (duration > 0) {
        setTimeout(() => {
            statusDiv.classList.add("hidden");
        }, duration);
    }
}

// Hide loading screen
function hideLoadingScreen() {
    const loadingScreen = document.getElementById("loadingScreen");
    if (loadingScreen) {
        loadingScreen.classList.add("hidden");
        setTimeout(() => {
            loadingScreen.remove();
        }, 500);
    }
}

// Main Application Class
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
        if (error.message.includes("Invalid API key")) {
            message = "Invalid database credentials. Please check your API key.";
        } else if (error.message.includes("not found")) {
            message = "Database table not found. Please check your database setup.";
        } else if (error.message.includes("CORS")) {
            message = "CORS error. Please check your domain settings in Supabase.";
        } else if (error.message.includes("timeout")) {
            message = "Connection timeout. Please check your internet connection.";
        } else if (error.message.includes("fetch")) {
            message = "Network error. Please check your internet connection.";
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
                "error",
                3000
            );
            setTimeout(() => this.testDatabaseConnection(), 3000);
        } else {
            showConnectionStatus(
                "Unable to connect to database. Please refresh the page.",
                "error",
                0
            );
            this.showOfflineMode();
        }
    }

    showOfflineMode() {
        this.showNotification(
            "Application is running in offline mode. Some features may not work.",
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
        // Signup form listeners
        const verifyBtn = document.getElementById("verifyBtn");
        const signupForm = document.getElementById("signupForm");
        const togglePassword = document.getElementById("togglePassword");
        const passwordInput = document.getElementById("password");
        const confirmPasswordInput = document.getElementById("confirmPassword");

        if (verifyBtn) verifyBtn.addEventListener("click", () => this.verifyHospital());
        if (signupForm) signupForm.addEventListener("submit", (e) => this.handleSignup(e));
        if (togglePassword)
            togglePassword.addEventListener("click", () =>
                this.togglePasswordVisibility("password", "togglePassword")
            );
        if (passwordInput)
            passwordInput.addEventListener("input", () => this.checkPasswordStrength());
        if (confirmPasswordInput)
            confirmPasswordInput.addEventListener("input", () =>
                this.validatePasswordMatch()
            );

        // Login form listeners
        const loginForm = document.getElementById("loginForm");
        const toggleLoginPassword = document.getElementById("toggleLoginPassword");
        const forgotPassword = document.getElementById("forgotPassword");

        if (loginForm) loginForm.addEventListener("submit", (e) => this.handleLogin(e));
        if (toggleLoginPassword)
            toggleLoginPassword.addEventListener("click", () =>
                this.togglePasswordVisibility("loginPassword", "toggleLoginPassword")
            );
        if (forgotPassword)
            forgotPassword.addEventListener("click", (e) => this.handleForgotPassword(e));

        // Dashboard listeners
        const verifyPatientBtn = document.getElementById("verifyPatientBtn");
        const addRecordForm = document.getElementById("addRecordForm");
        const logoutBtn = document.getElementById("logoutBtn");
        const attachmentsInput = document.getElementById("attachments");

        if (verifyPatientBtn)
            verifyPatientBtn.addEventListener("click", () => this.verifyPatient());
        if (addRecordForm)
            addRecordForm.addEventListener("submit", (e) => this.handleAddRecord(e));
        if (logoutBtn) logoutBtn.addEventListener("click", () => this.handleLogout());
        if (attachmentsInput)
            attachmentsInput.addEventListener("change", (e) => this.handleFileSelection(e));

        // Auto-verify patient
        const patientIdInput = document.getElementById("patientId");
        const patientPhoneInput = document.getElementById("patientPhone");
        const patientNameInput = document.getElementById("patientName");

        if (patientIdInput)
            patientIdInput.addEventListener("input", () => this.autoVerifyPatient());
        if (patientPhoneInput)
            patientPhoneInput.addEventListener("input", () => this.autoVerifyPatient());
        if (patientNameInput)
            patientNameInput.addEventListener("input", () => this.autoVerifyPatient());

        // Set minimum date for follow-up to today
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
            if (hospitalName) hospitalName.textContent = this.currentSession.hospitalName;
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
            console.error("❌ Form elements not found!");
            this.showNotification(
                "Form elements not loaded. Please refresh the page.",
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
                console.error("❌ Verification failed:", error);
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
            console.error("❌ Verification error:", error);
            this.showNotification("Verification failed. Please try again.", "error");
            showConnectionStatus("Verification error", "error");
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

            const { data, error } = await supabase
                .from("hospitals")
                .update({
                    password_hash: passwordHash,
                    admin_email: adminEmail,
                    contact_phone: contactPhone,
                    is_verified: true,
                })
                .eq("hospital_id", this.hospitalData.hospital_id);

            if (error) throw error;

            this.showNotification("Registration successful! Please login.", "success");
            setTimeout(() => this.showLogin(), 2000);
        } catch (error) {
            console.error("Signup error:", error);
            this.showNotification("Registration failed. Please try again.", "error");
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

            const passwordMatch = await this.verifyPassword(password, data.password_hash);

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
            this.showNotification("Login failed. Please try again.", "error");
        }
    }

    // Patient Verification
    async verifyPatient() {
        if (!this.checkDatabaseAvailability()) return;

        const patientId = document.getElementById("patientId").value;
        const patientPhone = document.getElementById("patientPhone").value;
        const patientName = document.getElementById("patientName").value;

        if (!patientId || !patientPhone || !patientName) {
            this.showNotification(
                "Please fill all patient verification fields",
                "error"
            );
            return;
        }

        try {
            const { data, error } = await supabase
                .from("patients")
                .select("*")
                .eq("patient_id", patientId)
                .eq("phone", patientPhone)
                .ilike("name", `%${patientName}%`)
                .single();

            if (error || !data) {
                this.showNotification(
                    "Patient not found. Please check the details.",
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
            this.showNotification("Verification failed. Please try again.", "error");
        }
    }

    autoVerifyPatient() {
        clearTimeout(this.autoSearchTimeout);
        const patientId = document.getElementById("patientId")?.value;
        const patientPhone = document.getElementById("patientPhone")?.value;
        const patientName = document.getElementById("patientName")?.value;

        if (patientId && patientPhone && patientName) {
            this.autoSearchTimeout = setTimeout(() => {
                this.verifyPatient();
            }, 1000);
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
                <div class="patient-details">
                    <h4>${patientData.name}</h4>
                    <p><strong>ABHA:</strong> ${patientData.abha_number || "Not provided"}</p>
                    <p><strong>Age:</strong> ${age} years | <strong>Gender:</strong> ${patientData.gender}</p>
                    <p><strong>Blood Group:</strong> ${patientData.blood_group || "N/A"}</p>
                    <p><strong>Phone:</strong> ${patientData.phone}</p>
                </div>
            `;
            patientInfo.classList.remove("hidden");
        } else {
            verificationStatus.className = "verification-status error";
            verificationStatus.innerHTML = `✗ Patient Not Verified`;
            patientInfo.classList.add("hidden");
        }
    }

    // CORRECTED: Medical Record Handling with proper column names
    async handleAddRecord(e) {
        e.preventDefault();
        if (!this.checkDatabaseAvailability()) return;

        if (!this.verifiedPatient) {
            this.showNotification("Please verify patient first", "error");
            return;
        }

        // CORRECTED: Use snake_case column names matching PostgreSQL schema
        const recordData = {
            record_number: this.generateRecordNumber(),
            patient_id: this.verifiedPatient.patient_id,
            hospital_id: this.currentSession.hospitalId,
            visit_date: new Date().toISOString().split('T')[0],
            visit_time: new Date().toTimeString().split(' ')[0],
            visit_type: document.getElementById("visitType")?.value || "OPD",
            record_type: document.getElementById("recordType")?.value || "OPD Consultation",
            doctor_name: document.getElementById("doctorName")?.value || "",
            doctor_registration_number: document.getElementById("doctorRegNumber")?.value || "",
            doctor_qualification: document.getElementById("doctorQualification")?.value || "",
            doctor_specialization: document.getElementById("doctorSpecialization")?.value || "",
            chief_complaint: document.getElementById("chiefComplaint")?.value || "",
            complaint_duration: document.getElementById("complaintDuration")?.value || "",
            provisional_diagnosis: document.getElementById("diagnosis")?.value || "",
            treatment_plan: document.getElementById("treatment")?.value || "",
            medications: this.parseMedications(document.getElementById("medications")?.value || ""),
            follow_up_date: document.getElementById("followUpDate")?.value || null,
            follow_up_instructions: document.getElementById("followUpInstructions")?.value || "",
            severity: document.getElementById("severity")?.value || "Medium",
            notes: document.getElementById("notes")?.value || "",
            attachments: JSON.stringify([]),
            can_edit_until: this.calculateEditDeadline(),
            is_editable: true
        };

        try {
            const { data, error } = await supabase
                .from("medical_records")
                .insert([recordData])
                .select();

            if (error) {
                console.error("Insert error:", error);
                throw error;
            }

            this.showNotification("Medical record added successfully!", "success");

            // Reset form
            const addRecordForm = document.getElementById("addRecordForm");
            if (addRecordForm) addRecordForm.reset();

            this.verifiedPatient = null;
            this.updatePatientVerificationUI(false);

            const recordFormSection = document.getElementById("recordFormSection");
            if (recordFormSection) recordFormSection.classList.add("hidden");

            await this.loadDashboardStats();

        } catch (error) {
            console.error("Error adding record:", error);
            this.showNotification(
                `Failed to add medical record: ${error.message}`,
                "error"
            );
        }
    }

    // Helper function to parse medications
    parseMedications(medicationsText) {
        if (!medicationsText) return null;

        try {
            return JSON.parse(medicationsText);
        } catch {
            return medicationsText.split('\n').filter(m => m.trim()).map(med => ({
                name: med.trim()
            }));
        }
    }

    generateRecordNumber() {
        const hospitalPrefix = this.currentSession.hospitalId.split("-")[0];
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
        return `REC-${hospitalPrefix}-${timestamp}-${random}`;
    }

    calculateEditDeadline() {
        const deadline = new Date();
        deadline.setHours(deadline.getHours() + 24); // 24 hours edit window
        return deadline.toISOString();
    }

    // Dashboard Functions
    async loadDashboardStats() {
        if (!this.checkDatabaseAvailability()) return;

        try {
            const { data: records, error } = await supabase
                .from("medical_records")
                .select("*")
                .eq("hospital_id", this.currentSession.hospitalId);

            if (error) throw error;

            const recordCountEl = document.getElementById("recordCount");
            if (recordCountEl) {
                recordCountEl.textContent = records ? records.length : 0;
            }

            await this.loadRecentRecords();
        } catch (error) {
            console.error("Error loading stats:", error);
        }
    }

    async loadRecentRecords() {
        if (!this.checkDatabaseAvailability()) return;

        try {
            const { data: records, error } = await supabase
                .from("medical_records")
                .select(`
                    *,
                    patients (
                        name,
                        abha_number,
                        phone
                    )
                `)
                .eq("hospital_id", this.currentSession.hospitalId)
                .order("created_at", { ascending: false })
                .limit(10);

            if (error) throw error;

            const recordsList = document.getElementById("recordsList");
            if (!recordsList) return;

            if (!records || records.length === 0) {
                recordsList.innerHTML = `
                    <div class="empty-state">
                        <p>No medical records found</p>
                        <p class="text-sm">Start by adding a new record</p>
                    </div>
                `;
                return;
            }

            recordsList.innerHTML = records
                .map(
                    (record) => `
                <div class="record-card">
                    <div class="record-header">
                        <h4>${record.patients?.name || "Unknown Patient"}</h4>
                        <span class="badge ${record.severity?.toLowerCase()}">${record.severity}</span>
                    </div>
                    <div class="record-details">
                        <p><strong>Record #:</strong> ${record.record_number}</p>
                        <p><strong>ABHA:</strong> ${record.patients?.abha_number || "Not provided"}</p>
                        <p><strong>Visit Date:</strong> ${new Date(record.visit_date).toLocaleDateString()}</p>
                        <p><strong>Chief Complaint:</strong> ${record.chief_complaint}</p>
                        <p><strong>Diagnosis:</strong> ${record.provisional_diagnosis || "N/A"}</p>
                        <p><strong>Doctor:</strong> ${record.doctor_name} ${
                        record.doctor_specialization ? "(" + record.doctor_specialization + ")" : ""
                    }</p>
                        ${
                            record.follow_up_date
                                ? `<p><strong>Follow-up:</strong> ${new Date(
                                      record.follow_up_date
                                  ).toLocaleDateString()}</p>`
                                : ""
                        }
                    </div>
                </div>
            `
                )
                .join("");
        } catch (error) {
            console.error("Error loading records:", error);
        }
    }

    switchDashboardView(view) {
        const dashboardView = document.getElementById("dashboardView");
        const addRecordView = document.getElementById("addRecordView");

        if (view === "dashboard") {
            if (dashboardView) dashboardView.classList.remove("hidden");
            if (addRecordView) addRecordView.classList.add("hidden");
            this.currentDashboardView = "dashboard";
        } else if (view === "addRecord") {
            if (dashboardView) dashboardView.classList.add("hidden");
            if (addRecordView) addRecordView.classList.remove("hidden");
            this.currentDashboardView = "addRecord";
        }
    }

    handleLogout() {
        localStorage.removeItem("hospitalSession");
        sessionStorage.removeItem("hospitalSession");
        this.currentSession = null;
        this.hospitalData = null;
        this.verifiedPatient = null;
        this.showNotification("Logged out successfully!", "success");
        this.showLogin();
    }

    // Utility Functions
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(hash))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }

    async verifyPassword(password, hash) {
        const inputHash = await this.hashPassword(password);
        return inputHash === hash;
    }

    validatePasswordStrength(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*]/.test(password);

        return (
            password.length >= minLength &&
            hasUpperCase &&
            hasLowerCase &&
            hasNumbers &&
            hasSpecialChar
        );
    }

    checkPasswordStrength() {
        const password = document.getElementById("password").value;
        const strengthMeter = document.getElementById("passwordStrength");
        if (!strengthMeter) return;

        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[!@#$%^&*]/.test(password)) strength++;

        const strengthText = ["Weak", "Fair", "Good", "Strong", "Very Strong"];
        const strengthClass = ["weak", "fair", "good", "strong", "strong"];

        strengthMeter.textContent = `Password Strength: ${strengthText[strength - 1] || "Weak"}`;
        strengthMeter.className = `password-strength ${strengthClass[strength - 1] || "weak"}`;
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
            matchIndicator.style.color = "#10b981";
        } else {
            matchIndicator.textContent = "✗ Passwords do not match";
            matchIndicator.style.color = "#ef4444";
        }
    }

    togglePasswordVisibility(inputId, toggleId) {
        const input = document.getElementById(inputId);
        const toggle = document.getElementById(toggleId);
        if (!input || !toggle) return;

        if (input.type === "password") {
            input.type = "text";
            toggle.textContent = "👁️";
        } else {
            input.type = "password";
            toggle.textContent = "👁️‍🗨️";
        }
    }

    calculateAge(dateOfBirth) {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        return age;
    }

    showNotification(message, type = "info") {
        const notification = document.createElement("div");
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add("show"), 10);

        setTimeout(() => {
            notification.classList.remove("show");
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    resetForms() {
        const forms = document.querySelectorAll("form");
        forms.forEach((form) => form.reset());

        const verificationStep = document.getElementById("verificationStep");
        const registrationStep = document.getElementById("registrationStep");
        if (verificationStep) verificationStep.classList.remove("hidden");
        if (registrationStep) registrationStep.classList.add("hidden");

        this.verifiedPatient = null;
        this.updatePatientVerificationUI(false);

        const recordFormSection = document.getElementById("recordFormSection");
        if (recordFormSection) recordFormSection.classList.add("hidden");
    }

    handleForgotPassword(e) {
        e.preventDefault();
        this.showNotification(
            "Password reset functionality will be implemented soon.",
            "info"
        );
    }

    handleFileSelection(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.showNotification(
                `${files.length} file(s) selected. Upload functionality coming soon.`,
                "info"
            );
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    window.mediSecureApp = new MediSecureApp();
});

// Navigation functions for HTML onclick events
function showSignup() {
    if (window.mediSecureApp) {
        window.mediSecureApp.showSignup();
    }
}

function showLogin() {
    if (window.mediSecureApp) {
        window.mediSecureApp.showLogin();
    }
}

function switchDashboardView(view) {
    if (window.mediSecureApp) {
        window.mediSecureApp.switchDashboardView(view);
    }
}

console.log("✅ MediSecure App script loaded successfully");
