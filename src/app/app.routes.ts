import { Routes } from '@angular/router';
import { CertificateChooserComponent } from './certificate-chooser/certificate-chooser.component';
import { UserInputComponent } from './user-input/user-input.component';
import { ReferenceOutputComponent } from './reference-output/reference-output.component';

export const routes: Routes = [
    { path: 'certificate-chooser', component: CertificateChooserComponent, data: { animation: 'CertificateChooser' } },
    { path: 'user-input', component: UserInputComponent, data: { animation: 'UserInput' } },
    { path: 'reference-output', component: ReferenceOutputComponent, data: { animation: 'ReferenceOutput' } },
    { path: '', redirectTo: '/certificate-chooser', pathMatch: 'full' },
];
