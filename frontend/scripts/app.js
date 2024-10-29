document.addEventListener("DOMContentLoaded", () => {
    const chatInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-button");
    const chatBox = document.getElementById("chat");

    let sessionId = null;
    let awaitingCategorySelection = false;
    let awaitingNewPlayerName = false;
    let previousTitles = [];
    let currentAnswer = "";
    let currentQuestion = "";
    let gameEnded = false;
    let awaitingRestartDecision = false;
    let questionCount = 0;
    let score = 0;

    // Agregar mensajes al chat
    function appendMessage(content, sender) {
        const messageBubble = document.createElement("div");
        messageBubble.className = `message-bubble ${sender === "user" ? "user-message" : "bot-message"}`;
        messageBubble.textContent = content;
        chatBox.appendChild(messageBubble);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Enviar solicitud al servidor
    async function sendRequest(endpoint, body) {
        console.log("Enviando solicitud a", endpoint, "con cuerpo:", body);

        // Incluir sessionId en el cuerpo si está disponible
        if (sessionId) {
            body.sessionId = sessionId;
        }

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                const data = await response.json();
                console.log("Respuesta recibida del servidor:", data);
                handleResponse(data);
            } else {
                console.error("Error en la solicitud: ", response.statusText);
                appendMessage("Ocurrió un error al procesar tu solicitud. Por favor, intenta nuevamente.", "bot");
            }
        } catch (error) {
            console.error("Error de red: ", error);
            appendMessage("Error de conexión. Por favor, verifica tu conexión a internet.", "bot");
        }
    }

    // Manejar la respuesta del servidor
    function handleResponse(data) {
        console.log("Manejando respuesta del servidor:", data);

        // Almacenar sessionId si está presente
        if (data.sessionId) {
            sessionId = data.sessionId;
        }

        switch (data.type) {
            case 'askName':
                // No mostrar el mensaje nuevamente si ya lo mostramos
                if (!awaitingNewPlayerName) {
                    appendMessage(data.content, "bot");
                }
                score = 0;
                questionCount = 0;
                currentAnswer = "";
                currentQuestion = "";
                awaitingNewPlayerName = true;
                break;

            case 'askCategory':
                appendMessage(data.content, "bot");
                awaitingCategorySelection = true;
                break;

            case 'greeting':
                appendMessage(data.content, "bot");
                awaitingCategorySelection = true;
                break;

            case 'question':
                appendMessage(data.content, "bot");
                currentAnswer = data.answer;
                currentQuestion = data.content;
                break;

            case 'answer':
                if (data.correct) {
                    appendMessage("¡Respuesta correcta! 🎉", "bot");
                    score += 100;
                } else {
                    const correctAns = data.correctAnswer || currentAnswer;
                    appendMessage(`Respuesta incorrecta. 😞 La respuesta correcta era: ${correctAns}`, "bot");
                }

                currentAnswer = "";

                if (data.next) {
                    sendRequest('/api/chat', { message: "nueva pregunta" });
                } else {
                    gameEnded = true;
                    appendMessage(`Juego terminado. Tu puntuación total es: ${score} puntos. ¿Quieres seguir jugando con el mismo usuario o cambiar de usuario? (mismo/nuevo/no)`, "bot");
                    awaitingRestartDecision = true;
                }
                break;

            case 'endGame':
                appendMessage(data.content, "bot");
                gameEnded = true;
                awaitingRestartDecision = false;
                break;

            default:
                console.error("Tipo de respuesta no manejado:", data.type);
        }
    }

    // Manejar envío al presionar el botón de enviar
    function handleSend() {
        const userInput = chatInput.value.trim();

        if (userInput.length === 0) return;

        appendMessage(userInput, "user");

        if (awaitingRestartDecision) {
            sendRequest('/api/restart', { message: userInput });
            awaitingRestartDecision = false;
        } else if (awaitingNewPlayerName) {
            sendRequest('/api/chat', { message: userInput });
            awaitingNewPlayerName = false;
        } else if (awaitingCategorySelection) {
            sendRequest('/api/chat', { message: userInput });
            awaitingCategorySelection = false;
        } else if (!currentAnswer && !currentQuestion) {
            sendRequest('/api/chat', { message: userInput });
        } else if (currentQuestion) {
            sendRequest('/api/answer', { userInput, correctAnswer: currentAnswer });
            currentQuestion = "";
        }

        chatInput.value = "";
    }

    sendButton.addEventListener("click", (event) => {
        event.preventDefault();
        handleSend();
    });

    chatInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleSend();
        }
    });

    // Iniciar el juego solicitando el nombre del usuario
    appendMessage("Por favor, ingresa tu nombre para comenzar.", "bot");
    awaitingNewPlayerName = true;

    // Enviar solicitud inicial para obtener sessionId
    sendRequest('/api/chat', { message: '' });
});
