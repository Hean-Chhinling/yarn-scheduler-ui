class BatchControlsView extends EventEmitter {
    constructor(appStateModel) {
        super();
        this.appStateModel = appStateModel; // To check if the queue-config tab is active

        this.batchControlsEl = DomUtils.getById('batch-controls');
        this.batchInfoEl = DomUtils.getById('batch-info');
        this.batchValidationEl = DomUtils.getById('batch-validation');
        this.applyChangesBtnEl = DomUtils.getById('btn-apply-changes');
        this.previewChangesBtnEl = DomUtils.getById('btn-preview-changes');
        this.discardChangesBtnEl = DomUtils.getById('btn-discard-changes');

        // Change preview modal elements
        this.previewModalEl = DomUtils.getById('change-preview-modal');
        this.previewContainerEl = DomUtils.getById('change-preview-container');
        this.closePreviewBtnEl = DomUtils.getById('close-preview-btn');
        this.applyFromPreviewBtnEl = DomUtils.getById('apply-from-preview-btn');

        if (
            !this.batchControlsEl ||
            !this.batchInfoEl ||
            !this.batchValidationEl ||
            !this.applyChangesBtnEl ||
            !this.previewChangesBtnEl ||
            !this.discardChangesBtnEl ||
            !this.previewModalEl ||
            !this.previewContainerEl
        ) {
            console.error('BatchControlsView: One or more required DOM elements are missing.');
            return;
        }

        // Initialize change preview
        this.changePreview = new ChangePreview(this.previewContainerEl, {
            showDiff: true,
            showSummary: true,
            collapsible: true,
            maxChanges: 50,
        });

        this._bindEvents();

        // Listen for tab changes to control visibility
        this.appStateModel.subscribe('currentTabChanged', () => this.renderVisibility());
        // The actual data update will be triggered by the controller based on SchedulerConfigModel changes.
    }

    _bindEvents() {
        this.applyChangesBtnEl.addEventListener('click', () => {
            if (!this.applyChangesBtnEl.disabled) {
                this._emit('applyAllClicked');
            }
        });

        this.previewChangesBtnEl.addEventListener('click', () => {
            this._emit('previewChangesClicked');
        });

        this.discardChangesBtnEl.addEventListener('click', () => {
            this._emit('discardAllClicked');
        });

        // Change preview modal events
        if (this.closePreviewBtnEl) {
            this.closePreviewBtnEl.addEventListener('click', () => {
                this.hidePreviewModal();
            });
        }

        if (this.applyFromPreviewBtnEl) {
            this.applyFromPreviewBtnEl.addEventListener('click', () => {
                this.hidePreviewModal();
                this._emit('applyAllClicked');
            });
        }

        // Close modal when clicking backdrop
        if (this.previewModalEl) {
            this.previewModalEl.addEventListener('click', (event) => {
                if (event.target === this.previewModalEl || event.target.classList.contains('modal-backdrop')) {
                    this.hidePreviewModal();
                }
            });

            // Close button in modal header
            const closeBtn = this.previewModalEl.querySelector('.close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.hidePreviewModal();
                });
            }
        }
    }

    /**
     * Renders the batch controls based on pending changes and validation status.
     * @param {Object} pendingCounts - { added: number, modified: number, deleted: number }
     * @param {Array<Object>} validationErrors - Array of error objects (e.g., { message: string })
     */
    render(pendingCounts, validationErrors = []) {
        const counts = pendingCounts || { added: 0, modified: 0, deleted: 0 };
        const totalChanges = counts.added + counts.modified + counts.deleted;

        if (totalChanges > 0) {
            const infoTextParts = [];
            if (counts.added > 0) infoTextParts.push(`${counts.added} added`);
            if (counts.modified > 0) infoTextParts.push(`${counts.modified} modified`);
            if (counts.deleted > 0) infoTextParts.push(`${counts.deleted} deleted`);
            this.batchInfoEl.textContent = infoTextParts.length > 0 ? infoTextParts.join(', ') : 'No changes staged';

            if (validationErrors.length === 0) {
                this.batchValidationEl.textContent = 'All changes valid ✓';
                this.batchValidationEl.className = 'batch-validation valid';
                this.applyChangesBtnEl.disabled = false;

                // Remove warning indicator from preview button
                this._removeWarningFromPreviewButton();
            } else {
                // Show concise error summary
                const errorCount = validationErrors.length;
                const errorTypes = [...new Set(validationErrors.map((e) => e.type || 'VALIDATION_ERROR'))];
                const primaryErrorType = this._formatErrorType(errorTypes[0]);

                this.batchValidationEl.textContent = `${errorCount} validation error${errorCount > 1 ? 's' : ''}: ${primaryErrorType}${errorCount > 1 ? ' +' + (errorCount - 1) + ' more' : ''}`;
                this.batchValidationEl.className = 'batch-validation'; // Default class implies error/warning

                // Add warning indicator to preview button
                this._addWarningToPreviewButton();
                this.applyChangesBtnEl.disabled = true;
            }
        }
        this.renderVisibility(totalChanges); // Pass totalChanges to avoid recalculating
    }

    /**
     * Formats error type string to be more readable
     * @param {string} errorType - Raw error type string
     * @returns {string} Formatted error type
     * @private
     */
    _formatErrorType(errorType) {
        if (!errorType) return 'validation issue';

        // Convert specific error types to readable format
        switch (errorType) {
            case 'MIXED_PERCENTAGE_WEIGHT_LEGACY': {
                return 'mixed capacity modes (percentage/weight)';
            }
            case 'ABSOLUTE_MODE_MIXING_LEGACY': {
                return 'mixed capacity modes (absolute with others)';
            }
            case 'CAPACITY_SUM_ERROR': {
                return 'capacity sum not 100%';
            }
            case 'INVALID_QUEUE_NAME': {
                return 'invalid queue name';
            }
            case 'INVALID_QUEUE_STATE': {
                return 'invalid queue state';
            }
            default: {
                // Generic fallback: convert SNAKE_CASE to readable format
                return errorType.toLowerCase().replaceAll('_', ' ');
            }
        }
    }

    /**
     * Adds warning indicator to preview button when validation errors exist
     * @private
     */
    _addWarningToPreviewButton() {
        if (this.previewChangesBtnEl && !this.previewChangesBtnEl.classList.contains('has-warnings')) {
            this.previewChangesBtnEl.classList.add('has-warnings');
            // Add warning emoji if not already present
            if (!this.previewChangesBtnEl.textContent.includes('⚠️')) {
                this.previewChangesBtnEl.textContent = '⚠️ ' + this.previewChangesBtnEl.textContent.trim();
            }
        }
    }

    /**
     * Removes warning indicator from preview button when no validation errors
     * @private
     */
    _removeWarningFromPreviewButton() {
        if (this.previewChangesBtnEl && this.previewChangesBtnEl.classList.contains('has-warnings')) {
            this.previewChangesBtnEl.classList.remove('has-warnings');
            // Remove warning emoji
            this.previewChangesBtnEl.textContent = this.previewChangesBtnEl.textContent.replace('⚠️ ', '');
        }
    }

    /**
     * Controls the visibility of the batch controls bar.
     * Visible only if there are changes AND the queue config tab is active.
     * @param {number} [changeCount=-1] - Optional change count to avoid re-fetching from model if already known.
     */
    renderVisibility(changeCount = -1) {
        // If changeCount isn't passed, this method would ideally get it from SchedulerConfigModel.hasPendingChanges()
        // For now, this.render() passes it. Controller will call this.render().
        const currentTab = this.appStateModel.getCurrentTab();
        const isActiveTabWithChanges =
            currentTab === 'queue-config-content' || currentTab === 'scheduler-config-content';
        const shouldShow = changeCount > 0 && isActiveTabWithChanges;

        if (shouldShow) {
            DomUtils.show(this.batchControlsEl, 'flex');
            this.batchControlsEl.classList.add('show');
        } else {
            DomUtils.hide(this.batchControlsEl);
            this.batchControlsEl.classList.remove('show');
        }
    }

    hide() {
        DomUtils.hide(this.batchControlsEl);
        this.batchControlsEl.classList.remove('show');
    }

    /**
     * Updates the change preview with current changes and validation errors.
     * @param {Object} changes - Changes to preview (ChangeLog format)
     * @param {Array} validationErrors - Array of validation errors to display
     */
    updateChangePreview(changes, validationErrors = []) {
        if (!this.changePreview) return;

        let previewChanges = [];

        if (changes && typeof changes.getChanges === 'function') {
            // ChangeLog format
            previewChanges = ChangePreview.fromChangeLog(changes);
        }

        this.changePreview.setChanges(previewChanges);
        this.changePreview.setValidationErrors(validationErrors);
    }

    /**
     * Shows the change preview modal.
     */
    showPreviewModal() {
        if (this.previewModalEl) {
            this.previewModalEl.style.display = 'flex';
            this.changePreview.render();
        }
    }

    /**
     * Hides the change preview modal.
     */
    hidePreviewModal() {
        if (this.previewModalEl) {
            this.previewModalEl.style.display = 'none';
        }
    }
}
