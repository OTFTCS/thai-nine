export type PromptPayIdType = "phone" | "nid";

export type BuildPromptPayPayloadInput = {
  id: string;
  idType: PromptPayIdType;
  amount?: number;
};

const AID_PROMPTPAY = "A000000677010111";

export function buildPromptPayPayload(input: BuildPromptPayPayloadInput): string {
  const { id, idType, amount } = input;

  const merchantInfoInner =
    tlv("00", AID_PROMPTPAY) +
    (idType === "phone" ? tlv("01", formatPhone(id)) : tlv("02", formatNid(id)));

  const initMethod = amount !== undefined ? "12" : "11";

  const head =
    tlv("00", "01") +
    tlv("01", initMethod) +
    tlv("29", merchantInfoInner) +
    tlv("53", "764") +
    (amount !== undefined ? tlv("54", formatAmount(amount)) : "") +
    tlv("58", "TH");

  const withCrcHeader = head + "6304";
  return withCrcHeader + crc16Ccitt(withCrcHeader);
}

export function crc16Ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function tlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${tag}${len}${value}`;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) throw new Error("promptpay_phone_too_short");
  const last9 = digits.slice(-9);
  return `0066${last9}`;
}

function formatNid(nid: string): string {
  const digits = nid.replace(/\D/g, "");
  if (digits.length !== 13) throw new Error("promptpay_nid_must_be_13_digits");
  return digits;
}

function formatAmount(amount: number): string {
  if (amount <= 0) throw new Error("promptpay_amount_must_be_positive");
  return amount.toFixed(2);
}
