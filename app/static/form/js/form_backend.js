// Backend API connection logic for form
// All fetch and backend-related functions are moved here from form.js

// Category APIs
export async function fetchCategories() {
    const res = await fetch('/api/categories/');
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
}

// Drafted questionnaires
export async function fetchDraftedQuestionnaires() {
    const res = await fetch('/api/drafts/');
    if (!res.ok) throw new Error('Failed to fetch drafts');
    return res.json();
}

// Topic APIs
export async function fetchTopics(categoryId) {
    const res = await fetch(`/api/topics/?category_id=${categoryId}`);
    if (!res.ok) throw new Error('Failed to fetch topics');
    return res.json();
}

// Note: Topic rename and delete endpoints are not implemented in the backend
// These functions are kept for future implementation
export async function renameTopic(topicId, name, csrftoken) {
    throw new Error('Topic rename functionality is not implemented in the backend');
}

export async function deleteTopic(topicId, csrftoken) {
    throw new Error('Topic delete functionality is not implemented in the backend');
}

export async function saveTopic(payload, csrftoken) {
    const res = await fetch('/api/save_topic/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken || (document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '')
        },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        let detail = 'Failed to save topic';
        try {
            const data = await res.json();
            if (data && data.error) detail = data.error;
        } catch (_) {
            try {
                detail = await res.text();
            } catch (_) {}
        }
        throw new Error(detail);
    }
    return res.json();
}

// Question APIs
export async function fetchQuestions(topicId) {
    const res = await fetch(`/api/topics/${topicId}/questions/`);
    if (!res.ok) throw new Error('Failed to fetch questions');
    return res.json();
}

export async function createQuestion(payload, csrftoken) {
    const res = await fetch('/api/question/create/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create question');
    return res.json();
}

export async function updateQuestion(qid, payload, csrftoken) {
    const res = await fetch(`/api/question/${qid}/update/`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to update question');
    return res.json();
}

export async function deleteQuestion(qid, csrftoken) {
    const res = await fetch(`/api/questions/${qid}/`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken, // <-- THIS IS CORRECT
            'Accept': 'application/json'
        },
        credentials: 'same-origin' // This is important for CSRF
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete question');
    }
    return res.json();
} 