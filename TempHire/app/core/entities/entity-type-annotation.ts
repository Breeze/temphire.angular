import { Validator } from 'breeze-client';

export class EntityTypeAnnotation {
    validators: Validator[];
    propertyAnnotations: EntityPropertyAnnotation[];
    ignoreForSerialization: string[];
    
    constructor(args: { validators?: Validator[], propertyAnnotations?: EntityPropertyAnnotation[], ignoreForSerialization?: string[] }) {
        this.validators = args.validators || [];
        this.propertyAnnotations = args.propertyAnnotations || [];
        this.ignoreForSerialization = args.ignoreForSerialization || [];
    }    
}

export class EntityPropertyAnnotation {
    displayName: string;
    validators: Validator[];
    constructor(public propertyName: string, config: {
        displayName: string,
        validators: Validator[],  
    }) {
        this.displayName = config.displayName;
        this.validators = config.validators;
    } 

}