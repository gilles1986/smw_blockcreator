{{#if x_direction "left"}}
{{#if mode}}
LDA $7B : CLC : ADC #-{{hex x_strength 2}} : STA $7B
{{else}}
LDA #-{{hex x_strength 2}} : STA $7B
{{/if}}
{{/if}}
{{#if x_direction "right"}}
{{#if mode}}
LDA $7B : CLC : ADC #{{hex x_strength 2}} : STA $7B
{{else}}
LDA #{{hex x_strength 2}} : STA $7B
{{/if}}
{{/if}}
{{#if x_direction "away"}}
{{#if slot "marioLeft" "marioRight" "marioInside" "marioHeadInside" "marioBodyInside" "marioTopCorner"}}
LDA $93
BEQ {{label "x_left"}}
LDA #{{hex x_strength 2}}
BRA {{label "x_set"}}
{{label "x_left"}}:
LDA #-{{hex x_strength 2}}
{{label "x_set"}}:
{{#if mode}}
CLC
ADC $7B
{{/if}}
STA $7B
{{/if}}
{{/if}}
{{#if x_direction "facing"}}
; $76 is the direction Mario faces: 0 left, 1 right.
LDA $76
BEQ {{label "f_left"}}
LDA #{{hex x_strength 2}}
BRA {{label "f_set"}}
{{label "f_left"}}:
LDA #-{{hex x_strength 2}}
{{label "f_set"}}:
{{#if mode}}
CLC
ADC $7B
{{/if}}
STA $7B
{{/if}}
{{#if y_direction "up"}}
{{#if mode}}
LDA $7D : CLC : ADC #-{{hex y_strength 2}} : STA $7D
{{else}}
LDA #-{{hex y_strength 2}} : STA $7D
{{/if}}
{{/if}}
{{#if y_direction "down"}}
{{#if mode}}
LDA $7D : CLC : ADC #{{hex y_strength 2}} : STA $7D
{{else}}
LDA #{{hex y_strength 2}} : STA $7D
{{/if}}
{{/if}}
{{#if y_direction "away"}}
{{#if slot "marioTop" "marioTopCorner"}}
{{#if mode}}
LDA $7D : CLC : ADC #-{{hex y_strength 2}} : STA $7D
{{else}}
LDA #-{{hex y_strength 2}} : STA $7D
{{/if}}
{{/if}}
{{#if slot "marioBottom"}}
{{#if mode}}
LDA $7D : CLC : ADC #{{hex y_strength 2}} : STA $7D
{{else}}
LDA #{{hex y_strength 2}} : STA $7D
{{/if}}
{{/if}}
{{/if}}
