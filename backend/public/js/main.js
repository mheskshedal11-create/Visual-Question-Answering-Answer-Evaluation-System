// ========================================
// CONSTANTS & VARIABLES
// ========================================
const API_URL = '/check/post';

// Elements
const imageInput = document.getElementById('imageInput');
const promptInput = document.getElementById('promptInput');
const submitBtn = document.getElementById('submitBtn');
const preview = document.getElementById('preview');
const results = document.getElementById('results');
const resultsContent = document.getElementById('resultsContent');
const loading = document.getElementById('loading');
const errorBox = document.getElementById('errorBox');
const errorMessage = document.getElementById('errorMessage');
const dropZone = document.getElementById('dropZone');
const uploadSection = document.getElementById('uploadSection');
const promptSection = document.getElementById('promptSection');
const infoBox = document.getElementById('infoBox');
const promptLabelText = document.getElementById('promptLabelText');
const quickPrompts = document.getElementById('quickPrompts');

let selectedFile = null;
let currentMode = 'image';

// ========================================
// MODE CONFIGURATION
// ========================================
const modeInfo = {
    image: {
        info: '<strong>Image Only Mode:</strong> Upload an image with your answer and get automatic checking and detailed feedback.',
        promptLabel: 'Custom Instructions (Optional):',
        hideUpload: false,
        hidePrompt: false,
        promptRequired: false
    },
    prompt: {
        info: '<strong>Prompt Only Mode:</strong> Ask any question or provide text to check without uploading an image.',
        promptLabel: 'Your Question or Text to Check:',
        hideUpload: true,
        hidePrompt: false,
        promptRequired: true
    },
    both: {
        info: '<strong>Both Mode:</strong> Upload an image AND provide custom instructions for specific analysis.',
        promptLabel: 'Custom Instructions (Required):',
        hideUpload: false,
        hidePrompt: false,
        promptRequired: true
    }
};

// ========================================
// MODE SELECTOR FUNCTIONALITY
// ========================================
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Update active state
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update current mode
        currentMode = btn.dataset.mode;

        // Update UI
        updateUI();
    });
});

function updateUI() {
    const mode = modeInfo[currentMode];

    // Update info box
    infoBox.querySelector('.info-content').innerHTML = mode.info;

    // Update prompt label
    promptLabelText.textContent = mode.promptLabel;

    // Show/hide sections
    if (mode.hideUpload) {
        uploadSection.classList.add('hidden');
        preview.innerHTML = '';
        selectedFile = null;
    } else {
        uploadSection.classList.remove('hidden');
    }

    if (mode.hidePrompt) {
        promptSection.classList.add('hidden');
    } else {
        promptSection.classList.remove('hidden');
    }

    // Update button state
    checkButtonState();

    // Clear error and results
    hideError();
    hideResults();
}

// ========================================
// FILE UPLOAD FUNCTIONALITY
// ========================================
imageInput.addEventListener('change', (e) => {
    handleFile(e.target.files[0]);
});

// Drag and drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFile(e.dataTransfer.files[0]);
});

dropZone.addEventListener('click', (e) => {
    if (e.target !== imageInput) {
        imageInput.click();
    }
});

function handleFile(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showError('Please select a valid image file (JPG, PNG, GIF)');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showError('File size must be less than 10MB');
        return;
    }

    selectedFile = file;
    checkButtonState();
    hideError();

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.innerHTML = `
            <img src="${e.target.result}" alt="Preview">
            <button class="remove-image-btn" onclick="removeImage()">✕ Remove Image</button>
        `;
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    selectedFile = null;
    preview.innerHTML = '';
    imageInput.value = '';
    checkButtonState();
}

// ========================================
// PROMPT FUNCTIONALITY
// ========================================
promptInput.addEventListener('input', checkButtonState);

// Quick prompts
document.querySelectorAll('.quick-prompt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        promptInput.value = btn.dataset.prompt;
        checkButtonState();
        promptInput.focus();
    });
});

// ========================================
// BUTTON STATE MANAGEMENT
// ========================================
function checkButtonState() {
    const hasPrompt = promptInput.value.trim().length > 0;
    const hasImage = selectedFile !== null;

    if (currentMode === 'image') {
        submitBtn.disabled = !hasImage;
    } else if (currentMode === 'prompt') {
        submitBtn.disabled = !hasPrompt;
    } else if (currentMode === 'both') {
        submitBtn.disabled = !hasImage || !hasPrompt;
    }
}

// ========================================
// FORM SUBMISSION
// ========================================
submitBtn.addEventListener('click', async () => {
    const hasPrompt = promptInput.value.trim().length > 0;
    const hasImage = selectedFile !== null;

    // Validate based on mode
    if (currentMode === 'image' && !hasImage) {
        showError('Please upload an image');
        return;
    }
    if (currentMode === 'prompt' && !hasPrompt) {
        showError('Please enter a prompt or question');
        return;
    }
    if (currentMode === 'both' && (!hasImage || !hasPrompt)) {
        showError('Please provide both image and prompt');
        return;
    }

    // Prepare request
    let requestBody;
    let headers = {};

    if (currentMode === 'prompt') {
        // Prompt only - JSON
        requestBody = JSON.stringify({ prompt: promptInput.value.trim() });
        headers['Content-Type'] = 'application/json';
    } else {
        // Image with optional/required prompt - FormData
        const formData = new FormData();
        formData.append('image', selectedFile);
        if (hasPrompt) {
            formData.append('prompt', promptInput.value.trim());
        }
        requestBody = formData;
    }

    // Show loading state
    showLoading();
    hideError();
    hideResults();
    submitBtn.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: headers,
            body: requestBody
        });

        const data = await response.json();

        if (data.success) {
            displayResults(data.data);
        } else {
            showError(data.message || 'Failed to analyze your submission');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Network error. Please check your connection and try again.');
    } finally {
        hideLoading();
        checkButtonState();
    }
});

// ========================================
// DISPLAY RESULTS
// ========================================
function displayResults(data) {
    const analysis = data.analysis;
    let html = '';

    // For prompt-only responses
    if (analysis.type === 'question' || analysis.type === 'answer_check' || analysis.type === 'text_response') {
        if (analysis.userInput) {
            html += createResultItem('📝 Your Input', `<p>${escapeHtml(analysis.userInput)}</p>`);
        }

        if (analysis.response) {
            html += createResultItem('💡 Response', `<p>${escapeHtml(analysis.response)}</p>`);
        }

        if (analysis.explanation) {
            html += createResultItem('📖 Explanation', `<p>${escapeHtml(analysis.explanation)}</p>`);
        }

        if (analysis.suggestions && analysis.suggestions.length > 0) {
            const suggestionsList = analysis.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('');
            html += createResultItem('💪 Suggestions', `<ul>${suggestionsList}</ul>`);
        }
    } else {
        // For image-based responses
        if (data.extractedText) {
            html += createResultItem('📝 Extracted Text', `<p>${escapeHtml(data.extractedText)}</p>`);
        }

        if (analysis.question) {
            html += createResultItem('❓ Question', `<p>${escapeHtml(analysis.question)}</p>`);
        }

        if (analysis.studentAnswer) {
            html += createResultItem('👤 Your Answer', `<p>${escapeHtml(analysis.studentAnswer)}</p>`);
        }

        if (analysis.isCorrect !== undefined) {
            const correctClass = analysis.isCorrect ? 'correct' : 'incorrect';
            const correctText = analysis.isCorrect ? '✅ Correct' : '❌ Incorrect';
            html += createResultItem('Correctness', `<p class="${correctClass}">${correctText}</p>`);
        }

        if (analysis.correctAnswer) {
            html += createResultItem('✨ Correct Answer', `<p>${escapeHtml(analysis.correctAnswer)}</p>`);
        }

        if (analysis.explanation) {
            html += createResultItem('💡 Explanation', `<p>${escapeHtml(analysis.explanation)}</p>`);
        }

        if (analysis.analysis) {
            html += createResultItem('🔍 Analysis', `<p>${escapeHtml(analysis.analysis)}</p>`);
        }

        if (analysis.mistakes && analysis.mistakes.length > 0) {
            const mistakesList = analysis.mistakes.map(m => `<li>${escapeHtml(m)}</li>`).join('');
            html += createResultItem('⚠️ Mistakes', `<ul>${mistakesList}</ul>`);
        }

        if (analysis.suggestions && analysis.suggestions.length > 0) {
            const suggestionsList = analysis.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('');
            html += createResultItem('💪 Suggestions', `<ul>${suggestionsList}</ul>`);
        }

        // If raw response
        if (analysis.rawResponse && !analysis.question && !analysis.response) {
            html += createResultItem('📄 Analysis', `<p>${escapeHtml(analysis.rawResponse)}</p>`);
        }
    }

    resultsContent.innerHTML = html;
    showResults();

    // Scroll to results
    setTimeout(() => {
        results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

function createResultItem(title, content) {
    return `
        <div class="result-item">
            <h3>${title}</h3>
            ${content}
        </div>
    `;
}

// ========================================
// UTILITY FUNCTIONS
// ========================================
function showLoading() {
    loading.classList.add('show');
}

function hideLoading() {
    loading.classList.remove('show');
}

function showError(message) {
    errorMessage.textContent = message;
    errorBox.classList.add('show');

    // Scroll to error
    setTimeout(() => {
        errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

function hideError() {
    errorBox.classList.remove('show');
}

function showResults() {
    results.classList.add('show');
}

function hideResults() {
    results.classList.remove('show');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// INITIALIZE
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    checkButtonState();
});

// Add CSS for remove button dynamically
const style = document.createElement('style');
style.textContent = `
    .remove-image-btn {
        margin-top: 15px;
        padding: 8px 20px;
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.3s ease;
    }
    .remove-image-btn:hover {
        background: #c82333;
        transform: translateY(-2px);
    }
`;
document.head.appendChild(style);