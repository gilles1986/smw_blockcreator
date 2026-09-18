{{#if change_x}}
{{#if mode}}
LDA !B6,x : CLC : ADC #{{signed x_speed}} : STA !B6,x
{{else}}
LDA #{{signed x_speed}} : STA !B6,x
{{/if}}
{{/if}}
{{#if change_y}}
{{#if mode}}
LDA !AA,x : CLC : ADC #{{signed y_speed}} : STA !AA,x
{{else}}
LDA #{{signed y_speed}} : STA !AA,x
{{/if}}
{{/if}}
