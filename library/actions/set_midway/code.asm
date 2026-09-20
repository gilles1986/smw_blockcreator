{{#if state "set"}}
LDA #$01
STA $13CE|!addr
{{#if sound}}
LDA #$05
STA $1DF9|!addr
{{/if}}
{{else}}
STZ $13CE|!addr
{{/if}}
