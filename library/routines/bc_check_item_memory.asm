; bc_check_item_memory: has this block already been marked as collected in Item Memory?
;
; Usage:
;   %bc_check_item_memory()
;   BCC .not_collected
;
; Output:
;   Carry SET: already collected ($19F8 bit is 1)
;   Carry CLEAR: not collected yet ($19F8 bit is 0)
;
; Notes:
;   Checks coordinate $98/$9A against $19F8.
;   Uses scratch $04, preserves X, Y and P. Clobbers A.

	PHP
	REP #$10                  ; 16-bit X/Y for stack push
	PHX
	PHY
	REP #$20                  ; 16-bit A
	LDA $9A
	AND #$FF00
	LSR #6
	STA $04
	LDA $9A
	AND #$0080
	LSR #7
	ORA $04
	STA $04
	LDA $98
	AND #$0100
	BEQ ?no_add
	LDA $04
	ORA #$0002
	STA $04
?no_add:
	LDA $13BE|!addr
	AND #$000F
	ASL
	TAX
	LDA.L $00BFFF|!bank,X
	CLC
	ADC $04
	STA $04
	TAY
	LDA $9A
	AND #$0070
	LSR #4
	TAX
	SEP #$20                  ; 8-bit A
	LDA $19F8|!addr,Y
	AND.L $00C005|!bank,X
	PHP                       ; save AND result flags
	REP #$10                  ; 16-bit X/Y for stack pull
	PLY
	PLX
	PLP                       ; restore AND result flags
	BEQ ?not_collected
	PLP                       ; restore caller's P
	SEC                       ; Carry set: already collected
	RTL
?not_collected:
	PLP                       ; restore caller's P
	CLC                       ; Carry clear: not collected
	RTL
