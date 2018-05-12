import { ErrorHandler as ExceptionHandler } from '@angular/core';

import { ErrorHandler } from './error-handler';

export function CustomExceptionHandlerFactory(errorHandler: ErrorHandler) {

    class CustomExceptionHandler implements ExceptionHandler {
        handleError(exception: any): void {
            // Pass exception to error handler.
            const error = exception.rejection || exception.originalException || exception;
            errorHandler.error(error);
        }
    }

    return new CustomExceptionHandler();
}

export const customExceptionHandlerProvider = {
    provide: ExceptionHandler,
    useFactory: CustomExceptionHandlerFactory,
    deps: [ErrorHandler]
};
