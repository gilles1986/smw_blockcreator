{{#if enabled "on"}}
LDA #$01
STA $1B96|!addr
{{else}}
STZ $1B96|!addr
{{/if}}
