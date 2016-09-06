import { Component, AfterViewInit } from '@angular/core';

@Component({
    selector: 'my-app',
    moduleId: module.id,
    templateUrl: './app.html'
})
export class AppComponent implements AfterViewInit {

    ngAfterViewInit() {
        // Scrollbar modal dialog fix
        // If you have a modal on your page that exceeds the browser height, 
        // then you can't scroll in it when closing an second modal.
        // from: http://stackoverflow.com/questions/19305821/multiple-modals-overlay
        $(document).on('hidden.bs.modal', '.modal', function () {
            $('.modal:visible').length && $(document.body).addClass('modal-open');
        });
    }
}
