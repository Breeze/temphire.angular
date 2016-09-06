import { Component, forwardRef, Optional, SkipSelf } from '@angular/core';

// In parent - add 
//    providers:  [provideParent(MyParentComponent)]

// In child - get access to parent with
//    constructor(@SkipSelf() parent: Parent ) { }
//       or 
//    constructor(parent: Parent ) { }  

// Use the first in child component is also a parentComponent

// Marker class, used as interface
export abstract class Parent {
  
}


// Helper method provides forward reference to an instance of a Parent component
// export const provideParent =
//    (component:any) => provide(Parent, { useExisting: forwardRef(() => component) });

// provide was removed in RC6
//export const provideParent = 
//    (component: any, parentClassAsInterface?: any) => provide(parentClassAsInterface || Parent, { useExisting: forwardRef(() => component) });

export const provideParent =
    (component: any, parentClassAsInterface?: any) => { return { provide: parentClassAsInterface || Parent, useExisting: forwardRef(() => component) } }; 
   
// Use by adding providers array to Parent component

// In parent - add 
//    providers:  [provideParent(MyParentComponent)]

// In child - get access to parent with
//    constructor(@SkipSelf() parent: Parent ) { }
//       or 
//    constructor(parent: Parent ) { }  

// Use the first in child component is also a parentComponent