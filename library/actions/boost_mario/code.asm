{{#if change_x}}
{{#if mode}}
LDA $7B : CLC : ADC #{{signed x_speed}} : STA $7B
{{else}}
LDA #{{signed x_speed}} : STA $7B
{{/if}}
{{/if}}
{{#if change_y}}
{{#if mode}}
LDA $7D : CLC : ADC #{{signed y_speed}} : STA $7D
{{else}}
LDA #{{signed y_speed}} : STA $7D
{{/if}}
{{/if}}
