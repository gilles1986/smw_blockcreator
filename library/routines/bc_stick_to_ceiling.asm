; bc_stick_to_ceiling: snaps Mario to ceiling underside and maintains cling speed if button held
;
; Input:
;   A: bit 7 = 1 (negative) to stick/cling, bit 7 = 0 (positive) to drop
; Output:
;   Mario Y ($96/$97) aligned to ceiling underside, $7D set to -$A4 (cling) or $00 (drop).
; Clobbers: A, scratch $00. Preserves X, Y.

	PHA                       ; save cling flag
	LDA $7D
	BMI ?moving_up            ; only active when Mario is moving upwards
	PLA                       ; restore stack
	RTL

?moving_up:
	EOR #$FF
	LSR #4
	INC
	STA $00
	STZ $13DC|!addr           ; clear vertical boost / slope flag
	PHX
	LDX #$00
	LDA $73
	BNE ?ducking
	LDA $19
	BNE ?no_powerup
?ducking:
	INX
?no_powerup:
	LDA $187A|!addr
	BEQ ?no_yoshi
	INX
	INX
?no_yoshi:
	LDA.W ?clipping_y,x
	PLX
	CLC
	ADC $00
	STA $00

	LDA $98
	SEC
	SBC #$20
	CLC
	ADC $00
	STA $96
	LDA $99
	SBC #$00
	ADC #$00
	STA $97

	PLA                       ; restore cling flag
	BPL ?drop
	LDA #$A4                  ; negative Y speed (cling to ceiling)
	STA $7D
	RTL

?drop:
	STZ $7D                   ; release from ceiling
	RTL

?clipping_y:
	db $18, $10, $10, $0D
