import { Injectable} from '@angular/core';
import { EntityError, core } from 'breeze-client';

import { DialogService } from './dialog.service';

export enum ErrorLevel {
    Exception, Info, Warning
};

@Injectable()
export class ErrorHandler {
    constructor(private dialogService: DialogService) { }

    // Handles error and returns a rejected promise.
    error(e: string | any): void {
        this.handle(e, ErrorLevel.Exception);
    }

    warning(e: string | any): void {
        this.handle(e, ErrorLevel.Warning);
    }

    info(e: string | any): void {
        this.handle(e, ErrorLevel.Info);
    }

    private handle(e: string | any, errorLevel?: ErrorLevel) {
        // Ignore error if it was already handled once. 
        if (e.errorWasHandled) return;

        errorLevel = errorLevel || ErrorLevel.Exception;
        let message = typeof e === 'string' ? e : this.userFriendlyErrorMessage(e);
        let entityErrors = this.formatEntityErrors(e.entityErrors);
        if (entityErrors && entityErrors !== '') {
            message = `${message}\n\n${entityErrors}`;
        }
        let logId = core.getUuid();
        if (this.shouldLogError(e)) {
            message = `${message}\n\nError ID: ${logId}`;
        }

        let title = this.errorTitle(e, errorLevel);
        let buttonsNames = this.getApplicableButtonNamesByError(e);
        this.dialogService.messageBox(title, message, buttonsNames).then(result => {
            if (result == 'Login') {
                document.location.reload();
            }
        });

        if (this.shouldLogError(e)) {
            let consoleMessage = `${title.toUpperCase()}: ${message}`;
            if (errorLevel === ErrorLevel.Exception) {
                console.error(consoleMessage);
            } else if (errorLevel === ErrorLevel.Warning) {
                console.warn(consoleMessage);
            } else if (errorLevel === ErrorLevel.Info) {
                console.info(consoleMessage);
            } else {
                console.log(consoleMessage);
            }
        }

        // Mark error as handled
        e.errorWasHandled = true;
    }

    private userFriendlyErrorMessage(e: any) {
        if (this.isHttpStatus(e, 401)) {
            e.message = 'You have been logged out due to inactivity. To continue, click on the Login button below and re-enter your credentials';
        }

        if (this.isHttpStatus(e, 500)) {
            e.message = 'An unexpected internal server error occured. Please try again later.';
        }

        if (e.entityErrors) {
            e.message = 'Please correct the following data issues and try again.';
        }

        return e.message || 'An unexpected error has occurred.';
    }

    private getApplicableButtonNamesByError(e: any): string[] {
        if (this.isHttpStatus(e, 401)) {
            return ['Login'];
        }

        return ['Ok'];      // Return the default Ok button for most errors.
    }

    private isHttpStatus(e: any, status: number) {
        return _.get(e, 'httpResponse.status', 200) == status;
    }

    private shouldLogError(e: any): boolean {
        if (this.isHttpStatus(e, 401)) return false;

        if (e.entityErrors) return false;

        return true;
    } 

    private formatEntityErrors(entityErrors: EntityError[]) {
        let s = '';
        if (!entityErrors || !entityErrors.length) return s;
        entityErrors.forEach(ee => {
            s += `- ${ee.errorMessage}\n`;
        });
        return s.trim();
    }

    private errorTitle(e: any, errorLevel: ErrorLevel): string {
        if (e.entityErrors) {
            return 'Invalid Data';
        }

        switch (errorLevel) {
            case ErrorLevel.Exception:
                return 'Error';
            case ErrorLevel.Info:
                return 'Information';
            case ErrorLevel.Warning:
                return 'Warning';
        }

        return 'Message';
    }
} 