/**
 * Form Workflow Manager
 * Handles workflow status transitions and validation according to the hierarchical approval system
 * 
 * Workflow Flow:
 * School (draft) → Submit → District (pending) → Approve → Division (pending) → 
 * Approve → Region (pending) → Approve → Central (pending) → Approve → Completed
 * 
 * Any level can return the form to school with {level}_returned status
 */

class FormWorkflowManager {
    constructor() {
        // Workflow status definitions
        this.workflowStatuses = {
            draft: 'draft',
            submitted: 'submitted',
            district_pending: 'district_pending',
            district_approved: 'district_approved',
            district_returned: 'district_returned',
            division_pending: 'division_pending',
            division_approved: 'division_approved',
            division_returned: 'division_returned',
            region_pending: 'region_pending',
            region_approved: 'region_approved',
            region_returned: 'region_returned',
            central_pending: 'central_pending',
            central_approved: 'central_approved',
            central_returned: 'central_returned',
            completed: 'completed'
        };
        
        // Level hierarchy
        this.levels = ['school', 'district', 'division', 'region', 'central'];
        
        // Status display names
        this.statusDisplayNames = {
            'draft': 'Draft',
            'submitted': 'Submitted',
            'district_pending': 'Pending District Review',
            'district_approved': 'District Approved',
            'district_returned': 'Returned by District',
            'division_pending': 'Pending Division Review',
            'division_approved': 'Division Approved',
            'division_returned': 'Returned by Division',
            'region_pending': 'Pending Region Review',
            'region_approved': 'Region Approved',
            'region_returned': 'Returned by Region',
            'central_pending': 'Pending Central Review',
            'central_approved': 'Central Approved',
            'central_returned': 'Returned by Central',
            'completed': 'Completed'
        };
        
        // Level display names
        this.levelDisplayNames = {
            'school': 'School',
            'district': 'District',
            'division': 'Division',
            'region': 'Region',
            'central': 'Central Office'
        };
    }
    
    /**
     * Get the next approval level in the workflow
     */
    getNextLevel(currentLevel) {
        const levelMap = {
            'school': 'district',
            'district': 'division',
            'division': 'region',
            'region': 'central',
            'central': 'completed'
        };
        return levelMap[currentLevel];
    }
    
    /**
     * Get the previous level in the workflow
     */
    getPreviousLevel(currentLevel) {
        const levelMap = {
            'district': 'school',
            'division': 'district',
            'region': 'division',
            'central': 'region'
        };
        return levelMap[currentLevel];
    }
    
    /**
     * Get the expected pending status for a level
     */
    getPendingStatus(level) {
        if (level === 'school') return 'draft';
        if (level === 'completed') return 'completed';
        return `${level}_pending`;
    }
    
    /**
     * Get the approved status for a level
     */
    getApprovedStatus(level) {
        if (level === 'school') return 'submitted';
        if (level === 'central') return 'completed';
        return `${level}_approved`;
    }
    
    /**
     * Get the returned status for a level
     */
    getReturnedStatus(level) {
        return `${level}_returned`;
    }
    
    /**
     * Check if a form is pending at a specific level
     */
    isPendingAtLevel(workflowStatus, level) {
        return workflowStatus === this.getPendingStatus(level);
    }
    
    /**
     * Check if a workflow status includes 'pending' or is 'submitted'
     */
    isPending(workflowStatus) {
        return workflowStatus && (workflowStatus.includes('_pending') || workflowStatus === 'submitted');
    }
    
    /**
     * Check if a workflow status includes 'returned'
     */
    isReturned(workflowStatus) {
        return workflowStatus && workflowStatus.includes('returned');
    }
    
    /**
     * Get display name for a status
     */
    getStatusDisplay(status) {
        return this.statusDisplayNames[status] || status;
    }
    
    /**
     * Get display name for a level
     */
    getLevelDisplay(level) {
        return this.levelDisplayNames[level] || level;
    }
    
    /**
     * Get current level from workflow status
     */
    getCurrentLevelFromStatus(workflowStatus) {
        if (workflowStatus === 'draft') {
            return 'school';
        }
        if (workflowStatus === 'submitted') {
            return 'district'; // Submitted forms are pending district review
        }
        if (workflowStatus === 'completed') {
            return 'central';
        }
        
        // Extract level from status like "district_pending"
        const match = workflowStatus.match(/^(district|division|region|central)_/);
        return match ? match[1] : null;
    }
    
    /**
     * Get workflow transition information for approve action
     */
    getApproveTransition(currentLevel) {
        const nextLevel = this.getNextLevel(currentLevel);
        
        if (nextLevel === 'completed') {
            return {
                fromLevel: currentLevel,
                toLevel: 'completed',
                fromStatus: this.getPendingStatus(currentLevel),
                toStatus: 'completed',
                description: `This will mark the form as completed and ready for the national database.`
            };
        }
        
        return {
            fromLevel: currentLevel,
            toLevel: nextLevel,
            fromStatus: this.getPendingStatus(currentLevel),
            toStatus: this.getPendingStatus(nextLevel),
            description: `This will forward the form to ${this.getLevelDisplay(nextLevel)} for review.`
        };
    }
    
    /**
     * Get workflow transition information for return action
     */
    getReturnTransition(currentLevel) {
        return {
            fromLevel: currentLevel,
            toLevel: 'school',
            fromStatus: this.getPendingStatus(currentLevel),
            toStatus: this.getReturnedStatus(currentLevel),
            description: `This will return the form to the school for revision. The school will need to resubmit after making corrections.`
        };
    }
    
    /**
     * Validate if an admin can approve a form at the current level
     */
    canApprove(adminLevel, formCurrentLevel) {
        return adminLevel === formCurrentLevel;
    }
    
    /**
     * Validate if an admin can return a form at the current level
     */
    canReturn(adminLevel, formCurrentLevel) {
        return adminLevel === formCurrentLevel;
    }
    
    /**
     * Get workflow stage information
     */
    getWorkflowStage(workflowStatus) {
        const currentLevel = this.getCurrentLevelFromStatus(workflowStatus);
        const isPending = this.isPending(workflowStatus);
        const isReturned = this.isReturned(workflowStatus);
        const isCompleted = workflowStatus === 'completed';
        
        return {
            status: workflowStatus,
            currentLevel: currentLevel,
            isPending: isPending,
            isReturned: isReturned,
            isCompleted: isCompleted,
            displayStatus: this.getStatusDisplay(workflowStatus),
            displayLevel: this.getLevelDisplay(currentLevel)
        };
    }
}

// Create global instance
window.FormWorkflowManager = FormWorkflowManager;

