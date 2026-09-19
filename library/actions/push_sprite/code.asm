{{#if x_direction "left"}}
{{#if mode}}
LDA !B6,x : CLC : ADC #-{{hex x_strength 2}} : STA !B6,x
{{else}}
LDA #-{{hex x_strength 2}} : STA !B6,x
{{/if}}
{{/if}}
{{#if x_direction "right"}}
{{#if mode}}
LDA !B6,x : CLC : ADC #{{hex x_strength 2}} : STA !B6,x
{{else}}
LDA #{{hex x_strength 2}} : STA !B6,x
{{/if}}
{{/if}}
{{#if x_direction "away"}}
{{#if slot "spriteLeft"}}
{{#if mode}}
LDA !B6,x : CLC : ADC #-{{hex x_strength 2}} : STA !B6,x
{{else}}
LDA #-{{hex x_strength 2}} : STA !B6,x
{{/if}}
{{/if}}
{{#if slot "spriteRight"}}
{{#if mode}}
LDA !B6,x : CLC : ADC #{{hex x_strength 2}} : STA !B6,x
{{else}}
LDA #{{hex x_strength 2}} : STA !B6,x
{{/if}}
{{/if}}
{{/if}}
{{#if y_direction "up"}}
{{#if mode}}
LDA !AA,x : CLC : ADC #-{{hex y_strength 2}} : STA !AA,x
{{else}}
LDA #-{{hex y_strength 2}} : STA !AA,x
{{/if}}
{{/if}}
{{#if y_direction "down"}}
{{#if mode}}
LDA !AA,x : CLC : ADC #{{hex y_strength 2}} : STA !AA,x
{{else}}
LDA #{{hex y_strength 2}} : STA !AA,x
{{/if}}
{{/if}}
{{#if y_direction "away"}}
{{#if slot "spriteTop"}}
{{#if mode}}
LDA !AA,x : CLC : ADC #-{{hex y_strength 2}} : STA !AA,x
{{else}}
LDA #-{{hex y_strength 2}} : STA !AA,x
{{/if}}
{{/if}}
{{#if slot "spriteBottom"}}
{{#if mode}}
LDA !AA,x : CLC : ADC #{{hex y_strength 2}} : STA !AA,x
{{else}}
LDA #{{hex y_strength 2}} : STA !AA,x
{{/if}}
{{/if}}
{{/if}}
