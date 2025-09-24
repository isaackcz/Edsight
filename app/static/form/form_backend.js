// Backend API connection logic for form
// All fetch and backend-related functions are moved here from form.js

// Category and sub-section APIs
export async function fetchCategories() {
    const res = await fetch('/api/categories/');
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
}

export async function fetchSubSections(categoryId) {
    const res = await fetch(`/api/sub_sections/?category_id=${categoryId}`);
    if (!res.ok) throw new Error('Failed to fetch sub-sections');
    return res.json();
}

// Drafted questionnaires
export async function fetchDraftedQuestionnaires() {
    const res = await fetch('/api/drafts/');
    if (!res.ok) throw new Error('Failed to fetch drafts');
    return res.json();
}

// Topic APIs
export async function fetchTopics(subSectionId) {
    const res = await fetch(`/api/topics/?sub_section_id=${subSectionId}`);
    if (!res.ok) throw new Error('Failed to fetch topics');
    return res.json();
}

export async function renameTopic(topicId, name, csrftoken) {
    const res = await fetch(`/api/topics/rename/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify({ topic_id: topicId, name })
    });
    if (!res.ok) throw new Error('Failed to rename topic');
    return res.json();
}

export async function deleteTopic(topicId, csrftoken) {
    const res = await fetch(`/api/topics/delete/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify({ topic_id: topicId })
    });
    if (!res.ok) throw new Error('Failed to delete topic');
    return res.json();
}

export async function saveTopic(payload, csrftoken) {
    const res = await fetch('/api/save_topic/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to save topic');
    return res.json();
}

// Question APIs
export async function fetchQuestions(topicId) {
    const res = await fetch(`/api/questions/${topicId}`);
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
        method: 'PUT',
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