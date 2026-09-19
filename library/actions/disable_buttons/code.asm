{{#if b}}
LDA #$80
TSB $0DAA|!addr
TSB $0DAB|!addr
{{/if}}
{{#if y}}
LDA #$40
TSB $0DAA|!addr
TSB $0DAB|!addr
{{/if}}
{{#if select}}
LDA #$20
TSB $0DAA|!addr
TSB $0DAB|!addr
{{/if}}
{{#if start}}
LDA #$10
TSB $0DAA|!addr
TSB $0DAB|!addr
{{/if}}
{{#if up}}
LDA #$08
TSB $0DAA|!addr
TSB $0DAB|!addr
{{/if}}
{{#if down}}
LDA #$04
TSB $0DAA|!addr
TSB $0DAB|!addr
{{/if}}
{{#if left}}
LDA #$02
TSB $0DAA|!addr
TSB $0DAB|!addr
{{/if}}
{{#if right}}
LDA #$01
TSB $0DAA|!addr
TSB $0DAB|!addr
{{/if}}
{{#if a}}
LDA #$80
TSB $0DAC|!addr
TSB $0DAD|!addr
{{/if}}
{{#if x}}
LDA #$40
TSB $0DAC|!addr
TSB $0DAD|!addr
{{/if}}
{{#if l}}
LDA #$20
TSB $0DAC|!addr
TSB $0DAD|!addr
{{/if}}
{{#if r}}
LDA #$10
TSB $0DAC|!addr
TSB $0DAD|!addr
{{/if}}
