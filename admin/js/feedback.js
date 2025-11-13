import { loadLayout } from './modules/layout.js';
import { checkAuth } from './modules/auth.js';
import { submitFeedback } from './modules/api.js';

// State management
const feedbackState = {
    responses: {},
    totalQuestions: 10
};

/**
 * Initialize the feedback page
 */
async function initFeedbackPage() {
    try {
        // Check authentication
        const isAuthenticated = checkAuth();
        
        if (!isAuthenticated) {
            return; // checkAuth will redirect to login
        }
        
        // Load navbar and sidebar
        await loadLayout();
        
        // Hide loading overlay
        setTimeout(() => {
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
        }, 500);
        
        // Initialize event listeners
        initThumbButtons();
        initFormSubmit();
        
    } catch (error) {
        console.error('Error initializing feedback page:', error);
        
        // Hide loading overlay on error
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
        
        toastr.error('Failed to load feedback page');
    }
}

/**
 * Initialize thumb button event listeners
 */
function initThumbButtons() {
    const thumbButtons = document.querySelectorAll('.thumb-btn');
    
    thumbButtons.forEach(button => {
        button.addEventListener('click', handleThumbClick);
    });
}

/**
 * Handle thumb button clicks
 */
function handleThumbClick(event) {
    const button = event.currentTarget;
    const questionNum = button.getAttribute('data-question');
    const response = button.getAttribute('data-response');
    
    // Get the question container
    const questionContainer = document.querySelector(`.feedback-question[data-question="${questionNum}"]`);
    
    // Get all buttons for this question
    const allButtons = questionContainer.querySelectorAll('.thumb-btn');
    
    // Remove active class from all buttons in this question
    allButtons.forEach(btn => btn.classList.remove('active'));
    
    // Add active class to clicked button
    button.classList.add('active');
    
    // Mark question as answered
    questionContainer.classList.add('answered');
    
    // Store the response
    feedbackState.responses[questionNum] = response;
    
    // Update progress
    updateProgress();
    
    // Add a satisfying animation
    button.style.transform = 'scale(1.2)';
    setTimeout(() => {
        button.style.transform = '';
    }, 200);
}

/**
 * Update progress indicators
 */
function updateProgress() {
    const answeredCount = Object.keys(feedbackState.responses).length;
    const percentage = Math.round((answeredCount / feedbackState.totalQuestions) * 100);
    
    // Update progress bar
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
        progressBar.setAttribute('aria-valuenow', percentage);
    }
    
    // Update answered count
    const answeredCountEl = document.getElementById('answered-count');
    if (answeredCountEl) {
        answeredCountEl.textContent = answeredCount;
    }
    
    // Update percentage text
    const percentageEl = document.getElementById('progress-percentage');
    if (percentageEl) {
        percentageEl.textContent = `${percentage}%`;
    }
    
    // Update circular progress
    const progressCircle = document.getElementById('progress-circle');
    if (progressCircle) {
        const circumference = 2 * Math.PI * 54; // radius is 54
        const offset = circumference - (percentage / 100) * circumference;
        progressCircle.style.strokeDashoffset = offset;
    }
    
    // Enable/disable submit button
    const submitButton = document.getElementById('submit-feedback');
    if (submitButton) {
        if (answeredCount === feedbackState.totalQuestions) {
            submitButton.disabled = false;
            submitButton.querySelector('i').classList.add('animate__animated', 'animate__bounce');
        } else {
            submitButton.disabled = true;
        }
    }
}

/**
 * Initialize form submission
 */
function initFormSubmit() {
    const form = document.getElementById('feedback-form');
    
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
}

/**
 * Handle form submission
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    
    // Check if all questions are answered
    if (Object.keys(feedbackState.responses).length !== feedbackState.totalQuestions) {
        toastr.warning('Please answer all questions before submitting');
        return;
    }
    
    const submitButton = document.getElementById('submit-feedback');
    const originalText = submitButton.innerHTML;
    
try {
    // Show loading state
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting...';
    
    // Get additional comments
    const comments = document.getElementById('additional-comments').value.trim();
    
    // Prepare feedback data
    const feedbackData = {
        question_1: feedbackState.responses['1'],
        question_2: feedbackState.responses['2'],
        question_3: feedbackState.responses['3'],
        question_4: feedbackState.responses['4'],
        question_5: feedbackState.responses['5'],
        question_6: feedbackState.responses['6'],
        question_7: feedbackState.responses['7'],
        question_8: feedbackState.responses['8'],
        question_9: feedbackState.responses['9'],
        question_10: feedbackState.responses['10'],
        additional_comments: comments || null
    };
    
    // Submit feedback using API function
    const result = await submitFeedback(feedbackData);
    
    // Show success message
    await Swal.fire({
        icon: 'success',
        title: 'Thank You!',
        html: `
            <p class="mb-3">Your feedback has been submitted successfully!</p>
            <p class="text-muted small">Your input helps us improve NauticalFlow for everyone in the maritime industry.</p>
        `,
        confirmButtonText: 'Continue',
        confirmButtonColor: '#00b4d8'
    });
    
    // Reset form
    resetForm();
    
    // Restore button to original state
    submitButton.disabled = true;
    submitButton.innerHTML = originalText;
    
} catch (error) {
        console.error('Error submitting feedback:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Submission Failed',
            text: error.message || 'Failed to submit feedback. Please try again.',
            confirmButtonColor: '#f5365c'
        });
        
        // Restore button
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

/**
 * Reset the form after successful submission
 */
function resetForm() {
    // Clear all active states
    document.querySelectorAll('.thumb-btn.active').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Clear answered states
    document.querySelectorAll('.feedback-question.answered').forEach(q => {
        q.classList.remove('answered');
    });
    
    // Clear additional comments
    document.getElementById('additional-comments').value = '';
    
    // Reset state
    feedbackState.responses = {};
    
    // Update progress
    updateProgress();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFeedbackPage);
} else {
    initFeedbackPage();
}
