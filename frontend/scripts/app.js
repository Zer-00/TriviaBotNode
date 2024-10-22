document.addEventListener("DOMContentLoaded", function() {
    const chat = document.getElementById("chat");
    const userInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-button");

    function addMessage(content, isUser = false) {
        const messageElement = document.createElement("div");
        messageElement.className = isUser ? "user-message" : "bot-message";
        messageElement.textContent = content;
        chat.appendChild(messageElement);
        chat.scrollTop = chat.scrollHeight; // Desplazarse hacia el final del contenedor de mensajes
    }

    function handleResponse(response) {
        if (response.type === 'askName') {
            addMessage(response.content);
        } else if (response.type === 'greetingAndQuestion') {
            // Agregar saludo y primera pregunta
            addMessage(response.content);
            addMessage(response.question);
            userInput.dataset.correctAnswer = response.answer;
        } else if (response.type === 'question') {
            addMessage(response.content);
            userInput.dataset.correctAnswer = response.answer;
        } else if (response.type === 'answer') {
            if (response.correct) {
                addMessage("¡Respuesta correcta! 🎉");
            } else {
                addMessage(`Respuesta incorrecta. 😞 La respuesta correcta era: ${userInput.dataset.correctAnswer}`);
            }

            if (response.next) {
                fetchNewQuestion();
            } else {
                // La trivia ha terminado, muestra la puntuación
                fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ message: "fin" })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.type === 'endGame') {
                        addMessage(data.content);
                    }
                })
                .catch(error => console.error('Error:', error));
            }
        }
    }

    function fetchNewQuestion() {
        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: 'nueva pregunta', previousTitles: [] })
        })
        .then(res => res.json())
        .then(data => handleResponse(data))
        .catch(error => console.error('Error:', error));
    }

    sendButton.addEventListener("click", function() {
        const message = userInput.value.trim();
        if (message === "") {
            return; // No envía mensajes vacíos
        }

        addMessage(message, true);
        if (!userInput.dataset.correctAnswer) {
            // Se está enviando el nombre del jugador
            fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            })
            .then(res => res.json())
            .then(data => handleResponse(data))
            .catch(error => console.error('Error:', error));
        } else {
            // Se está enviando una respuesta a una pregunta
            const correctAnswer = userInput.dataset.correctAnswer;
            fetch('/api/answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userInput: message, correctAnswer })
            })
            .then(res => res.json())
            .then(data => handleResponse(data))
            .catch(error => console.error('Error:', error));
        }
        userInput.value = ""; // Limpiar campo de entrada
    });

    userInput.addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendButton.click(); // Simular clic en el botón enviar
        }
    });

    // Inicializa la primera interacción pidiendo el nombre del jugador
    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: "" })
    })
    .then(res => res.json())
    .then(data => handleResponse(data))
    .catch(error => console.error('Error:', error));
});
