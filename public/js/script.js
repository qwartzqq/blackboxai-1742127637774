// DOM Elements
const pasteForm = {
    title: document.getElementById('pasteTitle'),
    content: document.getElementById('pasteContent'),
    syntax: document.getElementById('syntaxHighlight'),
    submitBtn: document.getElementById('submitPaste')
};

// Utility Functions
const generateUniqueId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const showNotification = (message, type = 'success') => {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
    } text-white success-message`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
};

const setLoading = (isLoading) => {
    const submitBtn = pasteForm.submitBtn;
    if (isLoading) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner mr-2"></div> Processing...';
    } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paste mr-2"></i>Paste';
    }
};

// Event Handlers
const handleSubmit = async (e) => {
    e.preventDefault();
    const title = pasteForm.title.value.trim() || 'Untitled Paste';
    const content = pasteForm.content.value.trim();
    const syntax = pasteForm.syntax.value;

    if (!content) {
        showNotification('Please enter some content', 'error');
        return;
    }

    setLoading(true);

    try {
        const response = await fetch('/api/paste', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title,
                content,
                syntax,
                timestamp: new Date().toISOString(),
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to create paste');
        }

        const data = await response.json();
        
        // Redirect to the new paste
        window.location.href = `/p/${data.id}`;
    } catch (error) {
        console.error('Error creating paste:', error);
        showNotification('Failed to create paste. Please try again.', 'error');
        setLoading(false);
    }
};

// Event Listeners
document.getElementById('pasteForm').addEventListener('submit', handleSubmit);

// Handle tab key in textarea
pasteForm.content.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        const value = e.target.value;
        
        e.target.value = value.substring(0, start) + '    ' + value.substring(end);
        e.target.selectionStart = e.target.selectionEnd = start + 4;
    }
});

// Auto-resize textarea
pasteForm.content.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Save draft to localStorage
let saveTimeout;
pasteForm.content.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        localStorage.setItem('pasteDraft', pasteForm.content.value);
    }, 1000);
});

// Load draft on page load
window.addEventListener('load', () => {
    const draft = localStorage.getItem('pasteDraft');
    if (draft) {
        pasteForm.content.value = draft;
    }
});

// Clear draft when submitted successfully
window.addEventListener('beforeunload', () => {
    localStorage.removeItem('pasteDraft');
});
