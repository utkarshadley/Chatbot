const messagesContainer = document.getElementById("messagesContainer");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const microphoneButton = document.getElementById("microphoneButton");
const cameraButton = document.getElementById("cameraButton");
const themeToggle = document.getElementById("themeToggle");

let isTyping = false;
let isRecording = false;
let recognition = null;
let selectedImage = null;
let selectedImageData = null;
let mapInstance = null;
let mapContainer = null;
let currentTheme = "light";
let chatbotData = null; // To store data fetched from data.json

// --- Theme Toggle Logic ---
function toggleTheme() {
  const htmlElement = document.documentElement;
  const themeIcon = themeToggle.querySelector("svg path");

  if (htmlElement.classList.contains("dark")) {
    htmlElement.classList.remove("dark");
    document.body.classList.remove("dark-theme");
    document.body.classList.add("light-theme");
    currentTheme = "light";
    themeIcon.setAttribute(
      "d",
      "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
    );
  } else {
    htmlElement.classList.add("dark");
    document.body.classList.remove("light-theme");
    document.body.classList.add("dark-theme");
    currentTheme = "dark";
    themeIcon.setAttribute(
      "d",
      "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
    );
  }
}

function loadInitialTheme() {
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    toggleTheme();
  } else {
    document.body.classList.add("light-theme");
  }
}

// --- Chat Message Functions ---
function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function createBotMessage(content, hasTyping = false) {
  const messageDiv = document.createElement("div");
  messageDiv.className = "flex justify-start mb-4";

  let messageContent = "";
  if (hasTyping) {
    messageContent =
      '<div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
  } else {
    const textWithBreaks = content.replace(/\n/g, "<br>");
    messageContent = `<p class="text-sm leading-relaxed">${textWithBreaks}</p>`;
  }

  messageDiv.innerHTML = `
            <div class="flex items-start space-x-3 max-w-xs md:max-w-sm">
                <div class="bot-avatar">
                    <div class="bot-eyes">
                        <div class="bot-eye"></div>
                        <div class="bot-eye"></div>
                    </div>
                </div>
                <div class="bg-gray-200 text-gray-800 rounded-3xl px-4 py-3 message-bubble bot-message">
                    ${messageContent}
                </div>
            </div>`;
  return messageDiv;
}

function createUserMessage(content) {
  const messageDiv = document.createElement("div");
  messageDiv.className = "flex justify-end mb-4";

  messageDiv.innerHTML = `
            <div class="flex items-start space-x-3 max-w-xs md:max-w-sm flex-row-reverse space-x-reverse">
                <div class="user-avatar">U</div>
                <div class="rounded-3xl px-4 py-3 message-bubble user-message">
                    <p class="text-sm leading-relaxed">${content}</p>
                </div>
            </div>`;
  return messageDiv;
}

// --- New function to handle UG Syllabus query ---
function handleUgSyllabusQuery() {
  let responseHtml = "UG Courses ke syllabus yahan hain:<br><br>";
  chatbotData.syllabuses.ug_syllabus.forEach((syllabus) => {
    if (syllabus.urls) {
      responseHtml += `**${syllabus.name}**: <br>`;
      syllabus.urls.forEach((link) => {
        responseHtml += `<a href='${link.url}' target='_blank' style='color:#3b82f6; text-decoration: underline;'>${link.name}</a><br>`;
      });
      responseHtml += "<br>";
    } else {
      responseHtml += `**${syllabus.name}**: <a href='${syllabus.url}' target='_blank' style='color:#3b82f6; text-decoration: underline;'>Click here for Syllabus</a><br><br>`;
    }
  });
  const botMessage = createBotMessage(responseHtml);
  messagesContainer.appendChild(botMessage);
}

// --- New function for PG Syllabus ---
function handlePgSyllabusQuery() {
  let responseHtml = "PG Courses ke syllabus yahan hain:<br><br>";
  chatbotData.syllabuses.pg_syllabus.forEach((syllabus) => {
    if (syllabus.urls) {
      responseHtml += `**${syllabus.name}**: <br>`;
      syllabus.urls.forEach((link) => {
        responseHtml += `<a href='${link.url}' target='_blank' style='color:#3b82f6; text-decoration: underline;'>${link.name}</a><br>`;
      });
      responseHtml += "<br>";
    } else {
      responseHtml += `**${syllabus.name}**: <a href='${syllabus.url}' target='_blank' style='color:#3b82f6; text-decoration: underline;'>Click here for Syllabus</a><br><br>`;
    }
  });
  const botMessage = createBotMessage(responseHtml);
  messagesContainer.appendChild(botMessage);
}

// --- Send Message Logic ---
async function sendMessage() {
  const message = messageInput.value.trim().toLowerCase();
  if ((!message && !selectedImage) || isTyping) return;

  messagesContainer.appendChild(createUserMessage(messageInput.value.trim()));
  messageInput.value = "";
  clearImagePreview();
  hideMap();
  scrollToBottom();

  isTyping = true;
  sendButton.disabled = true;
  const typingMessage = createBotMessage("", true);
  messagesContainer.appendChild(typingMessage);
  scrollToBottom();

  let botResponseText = "";
  let coords = null;

  const departmentKeywords = [
    "department",
    "departments",
    "course",
    "courses",
    "stream",
    "streams",
    "subject",
    "subjects",
  ];
  const isDepartmentQuery = departmentKeywords.some((keyword) =>
    message.includes(keyword)
  );

  const vocationalKeywords = [
    "vocational",
    "professional",
    "bba",
    "bca",
    "blis",
    "bsc it",
  ];
  const humanitiesKeywords = [
    "humanities",
    "english",
    "hindi",
    "urdu",
    "pali",
    "philosophy",
    "arts",
  ];
  const socialScienceKeywords = [
    "social science",
    "history",
    "geography",
    "economics",
    "political science",
    "psychology",
    "sociology",
    "home science",
  ];
  const commerceKeywords = ["commerce", "accounts", "b.com", "finance"];
  const scienceKeywords = [
    "science",
    "physics",
    "chemistry",
    "maths",
    "biology",
    "botany",
    "zoology",
  ];
  const ugSyllabusKeywords = [
    "ug syllabus",
    "ug syllabuses",
    "undergraduate syllabus",
  ];
  const pgSyllabusKeywords = [
    "pg syllabus",
    "pg syllabuses",
    "postgraduate syllabus",
    "master syllabus",
    "m.sc. syllabus",
    "m.a. syllabus",
    "m.com. syllabus",
    "mca syllabus",
    "m.sc. it syllabus",
  ];
  const holidayKeywords = ["holiday", "chutti", "holidays"];

  const isUgSyllabusQuery = ugSyllabusKeywords.some((keyword) =>
    message.includes(keyword)
  );
  const isPgSyllabusQuery = pgSyllabusKeywords.some((keyword) =>
    message.includes(keyword)
  );
  const isVocationalQuery = vocationalKeywords.some((keyword) =>
    message.includes(keyword)
  );
  const isHumanitiesQuery = humanitiesKeywords.some((keyword) =>
    message.includes(keyword)
  );
  const isSocialScienceQuery = socialScienceKeywords.some((keyword) =>
    message.includes(keyword)
  );
  const isCommerceQuery = commerceKeywords.some((keyword) =>
    message.includes(keyword)
  );
  const isScienceQuery = scienceKeywords.some((keyword) =>
    message.includes(keyword)
  );
  const isHolidayQuery = holidayKeywords.some((keyword) =>
    message.includes(keyword)
  );

  // General query keywords check
  if (isUgSyllabusQuery) {
    handleUgSyllabusQuery();
  } else if (isPgSyllabusQuery) {
    handlePgSyllabusQuery();
  } else if (isHolidayQuery) {
    botResponseText = chatbotData.holiday_list.details;
  } else if (isDepartmentQuery) {
    // This part can be improved to give a dynamic list based on data.json
    botResponseText =
      "Our college offers the following departments and courses:\n\n" +
      "1. Commerce Department\n" +
      "2. Humanities\n" +
      "3. Vocational Courses\n" +
      "4. Science\n" +
      "5. Social Science\n\n" +
      "Please choose an option or type your query to know more.";
  } else {
    // Default AI response for any other query
    try {
      const response = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: message }),
      });

      const data = await response.json();
      botResponseText = data.response.text;
      coords = data.response.coords;
    } catch (error) {
      console.error("Error fetching AI response:", error);
      botResponseText =
        "Maaf kijiye, AI service se jawab lene mein ek error aa gaya hai.";
    }
  }

  messagesContainer.removeChild(typingMessage);
  if (botResponseText) {
    messagesContainer.appendChild(createBotMessage(botResponseText));
  }

  if (coords) {
    showMap(coords);
  }

  isTyping = false;
  sendButton.disabled = false;
  updateSendButton();
  scrollToBottom();
}

// --- Map Functions ---
function hideMap() {
  const mapContainer = document.getElementById("map-container");
  mapContainer.style.display = "none";
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
}

function showMap(destinationCoords) {
  mapContainer = document.getElementById("map-container");
  mapContainer.style.display = "block";

  if (mapInstance) {
    mapInstance.remove();
  }

  mapInstance = L.map("map-container").setView(
    [destinationCoords.lat, destinationCoords.lng],
    15
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(mapInstance);

  L.marker([destinationCoords.lat, destinationCoords.lng])
    .addTo(mapInstance)
    .bindPopup("Destination")
    .openPopup();

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        L.marker([userCoords.lat, userCoords.lng])
          .addTo(mapInstance)
          .bindPopup("You are here.");

        const bounds = L.latLngBounds(
          [userCoords.lat, userCoords.lng],
          [destinationCoords.lat, destinationCoords.lng]
        );
        mapInstance.fitBounds(bounds, { padding: [50, 50] });

        L.polyline(
          [
            [userCoords.lat, userCoords.lng],
            [destinationCoords.lat, destinationCoords.lng],
          ],
          { color: "#3b82f6", weight: 4 }
        ).addTo(mapInstance);
      },
      () => {
        console.warn("Geolocation access denied.");
      }
    );
  }
}

// --- Image and Voice Input Logic ---
function clearImagePreview() {
  selectedImage = null;
  selectedImageData = null;
  const preview = document.getElementById("imagePreview");
  if (preview) {
    preview.remove();
  }
}

function showImagePreview(file, dataUrl) {
  clearImagePreview();
  selectedImage = file;
  selectedImageData = dataUrl;

  const previewContainer = document.createElement("div");
  previewContainer.id = "imagePreview";
  previewContainer.style.cssText = `
            position: relative;
            display: inline-block;
            margin-right: 8px;
            margin-bottom: 8px;
        `;

  const previewImg = document.createElement("img");
  previewImg.src = dataUrl;
  previewImg.style.cssText = `
            width: 60px;
            height: 60px;
            object-fit: cover;
            border-radius: 8px;
            border: 2px solid var(--border-color);
        `;

  const removeBtn = document.createElement("button");
  removeBtn.innerHTML = "×";
  removeBtn.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #ef4444;
            color: white;
            border: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
        `;

  removeBtn.onclick = clearImagePreview;
  previewContainer.appendChild(previewImg);
  previewContainer.appendChild(removeBtn);

  const inputContainer = document.querySelector(".p-4.input-area .flex");
  inputContainer.insertBefore(
    previewContainer,
    inputContainer.querySelector(".flex-1")
  );
  updateSendButton();
}

function updateSendButton() {
  const hasText = messageInput.value.trim().length > 0;
  const hasImage = selectedImage !== null;
  sendButton.disabled = (!hasText && !hasImage) || isTyping;
}

function toggleMicrophone() {
  if (!recognition) {
    alert(
      "Speech recognition is not supported in this browser. Please use a modern browser like Chrome or Edge."
    );
    return;
  }

  isRecording = !isRecording;
  microphoneButton.classList.toggle("active", isRecording);
  microphoneButton.title = isRecording ? "Stop recording" : "Voice message";

  if (isRecording) {
    recognition.start();
    messagesContainer.appendChild(createBotMessage("Listening...", true));
    scrollToBottom();
  } else {
    recognition.stop();
  }
}

function handleCamera() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.setAttribute("capture", "environment"); // Opens back camera on mobile
  fileInput.onchange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => showImagePreview(file, e.target.result);
      reader.readAsDataURL(file);
    }
  };
  fileInput.click();
}

// --- Event Listeners and Initial Setup ---
sendButton.addEventListener("click", sendMessage);
microphoneButton.addEventListener("click", toggleMicrophone);
cameraButton.addEventListener("click", handleCamera);
themeToggle.addEventListener("click", toggleTheme);

messageInput.addEventListener("keypress", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

messageInput.addEventListener("input", updateSendButton);

// Speech Recognition setup
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript;
    messageInput.value = transcript;
    isRecording = false;
    microphoneButton.classList.remove("active");
    messagesContainer.removeChild(messagesContainer.lastChild); // Remove "Listening..."
    sendMessage();
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    isRecording = false;
    microphoneButton.classList.remove("active");
    messagesContainer.removeChild(messagesContainer.lastChild);
    alert("An error occurred with speech recognition: " + event.error);
  };

  recognition.onend = () => {
    // Keep the "Listening..." message if it's not a final result
    if (isRecording) {
      recognition.start();
    }
  };
}

// Data fetching and initial state setup
async function loadData() {
  try {
    const response = await fetch("data.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    chatbotData = await response.json();
    // After data is loaded, you can update the chatbot with a greeting message if needed.
  } catch (error) {
    console.error("Could not fetch chatbot data:", error);
    messagesContainer.appendChild(
      createBotMessage("Maaf kijiye, data load karne mein ek error aa gaya hai.")
    );
  }
}

loadData();
sendButton.disabled = true;
updateSendButton();
loadInitialTheme();
scrollToBottom();

window.addEventListener("resize", scrollToBottom);