let chatHistory = [];

function openChat() { document.getElementById('chatbot').classList.add('open'); }
function closeChat() { document.getElementById('chatbot').classList.remove('open'); }

async function getAIResponse(message) {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message, history: chatHistory.slice(-10) })
    });
    const data = await res.json();
    return data.reply || "I couldn't process that. Please try again.";
  } catch (err) {
    return "I'm having trouble connecting. Please try again in a moment.";
  }
}

function addMsg(text, who) {
  var msgs = document.getElementById('chat-messages');
  var div = document.createElement('div');
  div.className = 'msg ' + who;
  div.innerHTML = text.replace(/\n/g, '<br>');
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function addTyping() {
  var msgs = document.getElementById('chat-messages');
  var div = document.createElement('div');
  div.className = 'msg typing'; div.id = 'typing-indicator';
  div.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function removeTyping() { var el = document.getElementById('typing-indicator'); if (el) el.remove(); }

async function sendChat() {
  var input = document.getElementById('chat-input');
  var text = input.value.trim();
  if (!text) return;
  addMsg(text, 'user');
  input.value = '';
  chatHistory.push({ role: 'user', text: text });
  addTyping();
  var reply = await getAIResponse(text);
  removeTyping();
  addMsg(reply, 'bot');
  chatHistory.push({ role: 'bot', text: reply });
}

function quickChat(text) {
  document.getElementById('chat-input').value = text;
  sendChat();
}
