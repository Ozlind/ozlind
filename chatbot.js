(() => {
  "use strict";

  const form =
    document.getElementById("chatForm");

  const input =
    document.getElementById("messageInput");

  const sendButton =
    document.getElementById("sendButton");

  const messagesContainer =
    document.getElementById("messages");

  const clearButton =
    document.getElementById("clearChat");

  const newChatButton =
    document.getElementById("newChatBtn");

  const charCount =
    document.getElementById("charCount");

  const mobileMenu =
    document.getElementById("mobileMenu");

  const sidebar =
    document.getElementById("sidebar");

  const searchInput =
    document.getElementById("searchInput");

  const navItems =
    [...document.querySelectorAll(".nav-item")];

  const featureCards =
    [...document.querySelectorAll(".feature-card")];


  const state = {
    messages: [],
    loading: false
  };


  /* =========================
     SECURITY
  ========================== */

  function escapeHTML(value) {

    const element =
      document.createElement("div");

    element.textContent = value;

    return element.innerHTML;
  }


  /* =========================
     UI HELPERS
  ========================== */

  function scrollMessages() {

    messagesContainer.scrollTop =
      messagesContainer.scrollHeight;
  }


  function updateCharacterCount() {

    charCount.textContent =
      `${input.value.length} / 8000`;
  }


  function removeEmptyState() {

    const empty =
      document.getElementById("emptyState");

    if (empty) {
      empty.remove();
    }
  }


  function addMessage(
    role,
    content,
    error = false
  ) {

    removeEmptyState();

    const message =
      document.createElement("div");

    message.className =
      `message ${role}`;


    const avatar =
      document.createElement("div");

    avatar.className =
      "message-avatar";

    avatar.textContent =
      role === "user"
        ? "AK"
        : "O";


    const bubble =
      document.createElement("div");

    bubble.className =
      `message-bubble ${
        error ? "error-bubble" : ""
      }`;

    bubble.innerHTML =
      escapeHTML(content);


    message.appendChild(avatar);
    message.appendChild(bubble);

    messagesContainer.appendChild(message);

    scrollMessages();

    return message;
  }


  function showTyping() {

    removeEmptyState();

    const message =
      document.createElement("div");

    message.className =
      "message assistant";

    message.id =
      "typingMessage";


    const avatar =
      document.createElement("div");

    avatar.className =
      "message-avatar";

    avatar.textContent =
      "O";


    const bubble =
      document.createElement("div");

    bubble.className =
      "message-bubble";

    bubble.innerHTML = `
      <span class="typing">
        <i></i>
        <i></i>
        <i></i>
      </span>
    `;


    message.appendChild(avatar);
    message.appendChild(bubble);

    messagesContainer.appendChild(message);

    scrollMessages();
  }


  function hideTyping() {

    const typing =
      document.getElementById(
        "typingMessage"
      );

    if (typing) {
      typing.remove();
    }
  }


  function setLoading(value) {

    state.loading =
      value;

    sendButton.disabled =
      value;

    input.disabled =
      value;

    sendButton.textContent =
      value
        ? "…"
        : "↑";
  }


  /* =========================
     SEND MESSAGE
  ========================== */

  async function sendMessage() {

    const content =
      input.value.trim();


    if (!content) {
      return;
    }


    if (state.loading) {
      return;
    }


    if (content.length > 8000) {
      addMessage(
        "assistant",
        "Your message is too long. Please keep it under 8000 characters.",
        true
      );

      return;
    }


    state.messages.push({
      role: "user",
      content
    });


    addMessage(
      "user",
      content
    );


    input.value = "";

    updateCharacterCount();

    setLoading(true);

    showTyping();


    try {

      const response =
        await fetch(
          "/api/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              messages:
                state.messages
            })
          }
        );


      let data;

      try {

        data =
          await response.json();

      } catch {

        throw new Error(
          "The server returned an invalid response."
        );

      }


      if (!response.ok) {

        throw new Error(
          data?.error ||
          `Request failed (${response.status}).`
        );

      }


      const reply =
        typeof data?.reply === "string"
          ? data.reply.trim()
          : "";


      if (!reply) {

        throw new Error(
          "The AI returned an empty response."
        );

      }


      hideTyping();


      state.messages.push({
        role: "assistant",
        content: reply
      });


      addMessage(
        "assistant",
        reply
      );


    } catch (error) {

      hideTyping();


      addMessage(
        "assistant",
        error?.message ||
          "Something went wrong. Please try again.",
        true
      );

    } finally {

      setLoading(false);

      input.focus();

    }
  }


  /* =========================
     CLEAR CHAT
  ========================== */

  function clearConversation() {

    if (state.loading) {
      return;
    }


    state.messages = [];


    messagesContainer.innerHTML = `
      <div
        class="empty-state"
        id="emptyState"
      >
        <div class="empty-icon">
          ✦
        </div>

        <strong>
          How can I help you today?
        </strong>

        <span>
          Ask OZLIND anything and start a conversation.
        </span>
      </div>
    `;


    input.value = "";

    updateCharacterCount();

    input.focus();
  }


  /* =========================
     FORM
  ========================== */

  form.addEventListener(
    "submit",
    (event) => {

      event.preventDefault();

      sendMessage();

    }
  );


  /* =========================
     ENTER TO SEND
  ========================== */

  input.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {

        event.preventDefault();

        sendMessage();

      }

    }
  );


  /* =========================
     AUTO RESIZE
  ========================== */

  input.addEventListener(
    "input",
    () => {

      updateCharacterCount();

      input.style.height =
        "auto";

      input.style.height =
        `${Math.min(
          input.scrollHeight,
          150
        )}px`;

    }
  );


  /* =========================
     CLEAR BUTTON
  ========================== */

  clearButton.addEventListener(
    "click",
    clearConversation
  );


  newChatButton.addEventListener(
    "click",
    () => {

      clearConversation();

      sidebar.classList.remove(
        "open"
      );

    }
  );


  /* =========================
     MOBILE SIDEBAR
  ========================== */

  mobileMenu.addEventListener(
    "click",
    () => {

      sidebar.classList.toggle(
        "open"
      );

    }
  );


  /* =========================
     NAVIGATION
  ========================== */

  navItems.forEach(
    (item) => {

      item.addEventListener(
        "click",
        () => {

          navItems.forEach(
            (nav) =>
              nav.classList.remove(
                "active"
              )
          );


          item.classList.add(
            "active"
          );


          const section =
            item.dataset.section;


          if (
            section === "chat"
          ) {

            document
              .getElementById(
                "chatSection"
              )
              .scrollIntoView({
                behavior:
                  "smooth"
              });

          } else {

            document
              .querySelector(
                ".features-section"
              )
              .scrollIntoView({
                behavior:
                  "smooth"
              });

          }


          sidebar.classList.remove(
            "open"
          );

        }
      );

    }
  );


  /* =========================
     SEARCH
  ========================== */

  searchInput.addEventListener(
    "input",
    () => {

      const query =
        searchInput.value
          .toLowerCase()
          .trim();


      featureCards.forEach(
        (card) => {

          const text =
            card.textContent
              .toLowerCase();


          card.style.display =
            !query ||
            text.includes(query)
              ? ""
              : "none";

        }
      );

    }
  );


  /* =========================
     INITIAL STATE
  ========================== */

  updateCharacterCount();

  input.focus();

})();
