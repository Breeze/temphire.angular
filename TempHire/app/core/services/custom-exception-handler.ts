import { ErrorHandler as ExceptionHandler } from '@angular/core';
import { ErrorHandler } from './error-handler';

function CustomExceptionHandlerFactory(errorHandler: ErrorHandler) {

    class CustomExceptionHandler implements ExceptionHandler {
        handleError(exception: any): void {
            // Pass exception to error handler.
            let error = exception.rejection || exception.originalException || exception;
            errorHandler.error(error);
        }
    }

    return new CustomExceptionHandler();
};

export const customExceptionHandlerProvider = {
    provide: ExceptionHandler,
    useFactory: CustomExceptionHandlerFactory,
    deps: [ErrorHandler]
};