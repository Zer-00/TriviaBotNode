document.addEventListener("DOMContentLoaded", () => {
    const chatInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-button");
    const chatBox = document.getElementById("chat");

    let awaitingNewPlayerName = false;
    let previousTitles = [];
    let currentAnswer = "";
    let currentQuestion = "";
    let gameEnded = false; // Variable para manejar el estado de finalización del juego
    let awaitingRestartDecision = false; // Para manejar si el usuario ya fue preguntado si desea reiniciar
    let questionCount = 0; // Variable para contar el número de preguntas realizadas
    let score = 0; // Variable para acumular el puntaje

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
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                const data = await response.json();
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
        switch (data.type) {
                // En 'askName' o 'greeting' en handleResponse
            case 'askName':
                appendMessage(data.content, "bot");
                score = 0; // Reiniciar puntaje en el frontend
                questionCount = 0; // Reiniciar contador de preguntas en el frontend
                currentAnswer = "";
                currentQuestion = "";
                break;

            case 'greeting':
                appendMessage(data.content, "bot");
                questionCount = 0; // Reiniciar el contador de preguntas
                score = 0; // Reiniciar la puntuación
                gameEnded = false; // Asegurarse de que gameEnded sea false al iniciar el nuevo ciclo
                awaitingRestartDecision = false; // Reiniciar el estado de reinicio
                currentAnswer = "";
                currentQuestion = "";
                sendRequest('/api/chat', { message: "nueva pregunta", previousTitles });
                break;

            case 'greetingAndQuestion':
                appendMessage(data.content, "bot");
                appendMessage(data.question, "bot");
                currentAnswer = data.answer;
                currentQuestion = data.question;
                break;

            case 'question':
                appendMessage(data.content, "bot");
                currentAnswer = data.answer;
                currentQuestion = data.content;
                break;

            case 'answer':
                if (data.correct) {
                    appendMessage("¡Respuesta correcta! 🎉", "bot");
                    score += 100; // Incrementar la puntuación cuando la respuesta es correcta
                } else {
                    appendMessage(`Respuesta incorrecta. 😞 La respuesta correcta era: ${currentAnswer}`, "bot");
                }

                questionCount++; // Incrementar el contador de preguntas

                if (questionCount < 5) {
                    sendRequest('/api/chat', { message: "nueva pregunta", previousTitles });
                } else {
                    gameEnded = true;
                    appendMessage(`Juego terminado. Tu puntuación total es: ${score} puntos. ¿Quieres seguir jugando con el mismo usuario o cambiar de usuario? (mismo/nuevo/no)`, "bot");
                    awaitingRestartDecision = true; // Mantener el estado de decisión
                }
                currentQuestion = "";
                break;

            case 'endGame':
                appendMessage(data.content, "bot");
                gameEnded = true;
                currentQuestion = "";
                currentAnswer = "";
                awaitingRestartDecision = false;
                break;

            case 'askContinue':
                appendMessage(data.content, "bot");
                awaitingRestartDecision = false;
                break;

            case 'greeting':
                appendMessage(data.content, "bot");
                questionCount = 0; // Reiniciar el contador de preguntas
                score = 0; // Reiniciar la puntuación
                gameEnded = false; // Asegurarse de que gameEnded sea false al iniciar el nuevo ciclo
                awaitingRestartDecision = false; // Reiniciar el estado de reinicio
                sendRequest('/api/chat', { message: "nueva pregunta", previousTitles });
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
            if (userInput.toLowerCase() === "mismo") {
                sendRequest('/api/continue', { message: "mismo" });
                awaitingRestartDecision = false;
            } else if (userInput.toLowerCase() === "nuevo") {
                sendRequest('/api/restart', { message: "nuevo" });
                awaitingRestartDecision = false;
                awaitingNewPlayerName = true; // Añade un nuevo estado para el nombre del jugador
            } else if (userInput.toLowerCase() === "no") {
                appendMessage("Gracias por jugar!", "bot");
                awaitingRestartDecision = false;
                gameEnded = true;
            } else {
                appendMessage("Por favor responde con 'mismo', 'nuevo', o 'no'.", "bot");
            }
        } else if (awaitingNewPlayerName) {
            // Envía el nuevo nombre del jugador y reinicia la trivia
            playerName = userInput;
            sendRequest('/api/chat', { message: playerName });
            awaitingNewPlayerName = false; // Resetea el estado
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

    sendRequest('/api/chat', { previousTitles });
});
