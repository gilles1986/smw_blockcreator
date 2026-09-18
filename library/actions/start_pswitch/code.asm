{{#if switch_type}}
LDA #{{timer}} : STA $14AE|!addr
{{else}}
LDA #{{timer}} : STA $14AD|!addr
{{/if}}
