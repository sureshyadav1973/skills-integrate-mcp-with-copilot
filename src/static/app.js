document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginModal = document.getElementById("login-modal");
  const loginToggle = document.getElementById("teacher-login-toggle");
  const logoutButton = document.getElementById("teacher-logout");
  const loginCancel = document.getElementById("teacher-login-cancel");
  const loginForm = document.getElementById("teacher-login-form");
  const teacherStatus = document.getElementById("teacher-status");

  let teacherSession = {
    username: localStorage.getItem("teacherUsername"),
    token: localStorage.getItem("teacherToken"),
  };

  function isTeacherLoggedIn() {
    return Boolean(teacherSession.username && teacherSession.token);
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function setTeacherSession(username, token) {
    teacherSession = { username, token };
    localStorage.setItem("teacherUsername", username);
    localStorage.setItem("teacherToken", token);
  }

  function clearTeacherSession() {
    teacherSession = { username: null, token: null };
    localStorage.removeItem("teacherUsername");
    localStorage.removeItem("teacherToken");
  }

  function updateAuthUI() {
    const loggedIn = isTeacherLoggedIn();
    teacherStatus.textContent = loggedIn
      ? `Teacher mode: ${teacherSession.username}`
      : "Viewing as student";

    loginToggle.classList.toggle("hidden", loggedIn);
    logoutButton.classList.toggle("hidden", !loggedIn);

    Array.from(signupForm.elements).forEach((element) => {
      element.disabled = !loggedIn;
    });
  }

  function openLoginModal() {
    loginModal.classList.remove("hidden");
  }

  function closeLoginModal() {
    loginModal.classList.add("hidden");
    loginForm.reset();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        isTeacherLoggedIn()
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isTeacherLoggedIn()) {
      showMessage("Only logged-in teachers can unregister students.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "X-Teacher-Token": teacherSession.token,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          clearTeacherSession();
          updateAuthUI();
        }
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isTeacherLoggedIn()) {
      showMessage("Only logged-in teachers can register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            "X-Teacher-Token": teacherSession.token,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          clearTeacherSession();
          updateAuthUI();
        }
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginToggle.addEventListener("click", openLoginModal);
  loginCancel.addEventListener("click", closeLoginModal);

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("teacher-username").value;
    const password = document.getElementById("teacher-password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        showMessage(result.detail || "Teacher login failed.", "error");
        return;
      }

      setTeacherSession(result.username, result.token);
      updateAuthUI();
      closeLoginModal();
      showMessage(`Logged in as ${result.username}.`, "success");
      fetchActivities();
    } catch (error) {
      showMessage("Unable to login right now.", "error");
      console.error("Login failed:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      if (teacherSession.token) {
        await fetch("/auth/logout", {
          method: "POST",
          headers: {
            "X-Teacher-Token": teacherSession.token,
          },
        });
      }
    } finally {
      clearTeacherSession();
      updateAuthUI();
      fetchActivities();
      showMessage("Logged out.", "info");
    }
  });

  updateAuthUI();

  // Initialize app
  fetchActivities();
});
