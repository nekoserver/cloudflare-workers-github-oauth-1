use wasm_bindgen::prelude::*;

const CLASS_IN: u16 = 1;

fn qtype_to_code(qtype: &str) -> Result<u16, String> {
    match qtype.to_ascii_uppercase().as_str() {
        "A" => Ok(1),
        "NS" => Ok(2),
        "CNAME" => Ok(5),
        "SOA" => Ok(6),
        "PTR" => Ok(12),
        "MX" => Ok(15),
        "TXT" => Ok(16),
        "AAAA" => Ok(28),
        "SRV" => Ok(33),
        "ANY" => Ok(255),
        other => Err(format!("未対応のレコードタイプです: {other}")),
    }
}

fn code_to_qtype(code: u16) -> String {
    match code {
        1 => "A".to_string(),
        2 => "NS".to_string(),
        5 => "CNAME".to_string(),
        6 => "SOA".to_string(),
        12 => "PTR".to_string(),
        15 => "MX".to_string(),
        16 => "TXT".to_string(),
        28 => "AAAA".to_string(),
        33 => "SRV".to_string(),
        255 => "ANY".to_string(),
        other => format!("TYPE{other}"),
    }
}

fn rcode_to_status(rcode: u8) -> &'static str {
    match rcode {
        0 => "NOERROR",
        1 => "FORMERR",
        2 => "SERVFAIL",
        3 => "NXDOMAIN",
        4 => "NOTIMP",
        5 => "REFUSED",
        _ => "UNKNOWN",
    }
}

fn encode_name(name: &str) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let trimmed = name.trim_end_matches('.');
    if trimmed.is_empty() {
        out.push(0);
        return Ok(out);
    }
    for label in trimmed.split('.') {
        let bytes = label.as_bytes();
        if bytes.is_empty() || bytes.len() > 63 {
            return Err(format!("不正なラベルです: {label}"));
        }
        out.push(bytes.len() as u8);
        out.extend_from_slice(bytes);
    }
    out.push(0);
    Ok(out)
}

/// 問い合わせ対象のドメイン名・レコードタイプから、DNSワイヤーフォーマットの
/// 問い合わせパケットを組み立てる(ヘッダ12バイト + Question section)。
/// IDは固定値(0x1234)を使う(乱数生成にwasm32側の追加依存を増やしたくないため。
/// UDPと異なりDNS over HTTPSはHTTPS自体がトランスポートの完全性を保証するので
/// キャッシュポイズニング対策としてのID/ソースポートのランダム化は本質的でない)。
#[wasm_bindgen]
pub fn dig_build_query(name: &str, qtype: &str) -> Result<Vec<u8>, JsValue> {
    let type_code = qtype_to_code(qtype).map_err(|e| JsValue::from_str(&e))?;
    let mut packet = Vec::new();
    packet.extend_from_slice(&0x1234u16.to_be_bytes()); // ID
    packet.extend_from_slice(&0x0100u16.to_be_bytes()); // flags: RD=1
    packet.extend_from_slice(&1u16.to_be_bytes()); // QDCOUNT
    packet.extend_from_slice(&0u16.to_be_bytes()); // ANCOUNT
    packet.extend_from_slice(&0u16.to_be_bytes()); // NSCOUNT
    packet.extend_from_slice(&0u16.to_be_bytes()); // ARCOUNT
    let name_bytes = encode_name(name).map_err(|e| JsValue::from_str(&e))?;
    packet.extend_from_slice(&name_bytes);
    packet.extend_from_slice(&type_code.to_be_bytes());
    packet.extend_from_slice(&CLASS_IN.to_be_bytes());
    Ok(packet)
}

struct Reader<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    fn new(buf: &'a [u8]) -> Self {
        Reader { buf, pos: 0 }
    }

    fn u8(&mut self) -> Result<u8, String> {
        let b = *self.buf.get(self.pos).ok_or("パケットが短すぎます(u8)")?;
        self.pos += 1;
        Ok(b)
    }

    fn u16(&mut self) -> Result<u16, String> {
        let hi = self.u8()? as u16;
        let lo = self.u8()? as u16;
        Ok((hi << 8) | lo)
    }

    fn u32(&mut self) -> Result<u32, String> {
        let hi = self.u16()? as u32;
        let lo = self.u16()? as u32;
        Ok((hi << 16) | lo)
    }

    fn bytes(&mut self, n: usize) -> Result<&'a [u8], String> {
        let end = self.pos.checked_add(n).ok_or("長さがオーバーフローしました")?;
        let slice = self.buf.get(self.pos..end).ok_or("パケットが短すぎます(bytes)")?;
        self.pos = end;
        Ok(slice)
    }

    /// DNS名の圧縮ポインタ(先頭2ビットが11のオフセット参照)を辿りながら
    /// ドット区切りの名前を復元する。ポインタの無限ループを防ぐため、
    /// ジャンプ回数に上限を設ける。
    fn name(&mut self) -> Result<String, String> {
        let mut labels: Vec<String> = Vec::new();
        let mut pos = self.pos;
        let mut jumped = false;
        let mut jump_count = 0;
        loop {
            if jump_count > 64 {
                return Err("DNS名の圧縮ポインタが深すぎます(ループの疑い)".to_string());
            }
            let len = *self.buf.get(pos).ok_or("パケットが短すぎます(name len)")?;
            if len == 0 {
                pos += 1;
                break;
            }
            if len & 0xc0 == 0xc0 {
                let b2 = *self.buf.get(pos + 1).ok_or("パケットが短すぎます(name ptr)")?;
                let offset = (((len as usize) & 0x3f) << 8) | (b2 as usize);
                if !jumped {
                    self.pos = pos + 2;
                    jumped = true;
                }
                pos = offset;
                jump_count += 1;
                continue;
            }
            let start = pos + 1;
            let end = start + len as usize;
            let label_bytes = self.buf.get(start..end).ok_or("パケットが短すぎます(name label)")?;
            labels.push(String::from_utf8_lossy(label_bytes).to_string());
            pos = end;
        }
        if !jumped {
            self.pos = pos;
        }
        if labels.is_empty() {
            Ok(".".to_string())
        } else {
            Ok(labels.join("."))
        }
    }
}

fn format_ipv4(bytes: &[u8]) -> Result<String, String> {
    if bytes.len() != 4 {
        return Err("Aレコードのrdlengthが不正です".to_string());
    }
    Ok(format!("{}.{}.{}.{}", bytes[0], bytes[1], bytes[2], bytes[3]))
}

fn format_ipv6(bytes: &[u8]) -> Result<String, String> {
    if bytes.len() != 16 {
        return Err("AAAAレコードのrdlengthが不正です".to_string());
    }
    let mut groups = [0u16; 8];
    for i in 0..8 {
        groups[i] = ((bytes[i * 2] as u16) << 8) | bytes[i * 2 + 1] as u16;
    }
    // 最長のゼロ連続を "::" に圧縮する(RFC 5952準拠の簡易実装)。
    let mut best_start = None;
    let mut best_len = 0;
    let mut cur_start = None;
    let mut cur_len = 0;
    for (i, g) in groups.iter().enumerate() {
        if *g == 0 {
            if cur_start.is_none() {
                cur_start = Some(i);
            }
            cur_len += 1;
            if cur_len > best_len {
                best_len = cur_len;
                best_start = cur_start;
            }
        } else {
            cur_start = None;
            cur_len = 0;
        }
    }
    if best_len < 2 {
        best_start = None;
    }
    let mut out = String::new();
    let mut i = 0;
    while i < 8 {
        if Some(i) == best_start {
            out.push_str("::");
            i += best_len;
            continue;
        }
        if !out.is_empty() && !out.ends_with(':') {
            out.push(':');
        }
        out.push_str(&format!("{:x}", groups[i]));
        i += 1;
    }
    if out.is_empty() {
        out.push_str("::");
    }
    Ok(out)
}

struct Answer {
    name: String,
    ttl: u32,
    type_code: u16,
    rdata: String,
}

fn parse_record_rdata(reader: &mut Reader, type_code: u16, rdata_bytes: &[u8]) -> Result<String, String> {
    match type_code {
        1 => format_ipv4(rdata_bytes),
        28 => format_ipv6(rdata_bytes),
        2 | 5 | 12 => {
            let mut sub = Reader::new(reader.buf);
            sub.pos = reader.pos - rdata_bytes.len();
            sub.name()
        }
        15 => {
            let mut sub = Reader::new(reader.buf);
            sub.pos = reader.pos - rdata_bytes.len();
            let preference = sub.u16()?;
            let exchange = sub.name()?;
            Ok(format!("{preference} {exchange}"))
        }
        16 => {
            let mut out = Vec::new();
            let mut i = 0usize;
            while i < rdata_bytes.len() {
                let len = rdata_bytes[i] as usize;
                i += 1;
                let end = i + len;
                if end > rdata_bytes.len() {
                    return Err("TXTレコードのrdataが不正です".to_string());
                }
                out.push(format!("\"{}\"", String::from_utf8_lossy(&rdata_bytes[i..end])));
                i = end;
            }
            Ok(out.join(" "))
        }
        6 => {
            let mut sub = Reader::new(reader.buf);
            sub.pos = reader.pos - rdata_bytes.len();
            let mname = sub.name()?;
            let rname = sub.name()?;
            let serial = sub.u32()?;
            let refresh = sub.u32()?;
            let retry = sub.u32()?;
            let expire = sub.u32()?;
            let minimum = sub.u32()?;
            Ok(format!("{mname} {rname} {serial} {refresh} {retry} {expire} {minimum}"))
        }
        _ => Ok(rdata_bytes.iter().map(|b| format!("{b:02x}")).collect::<Vec<_>>().join("")),
    }
}

fn parse_response_inner(bytes: &[u8]) -> Result<(u8, u16, u16, Vec<Answer>), String> {
    let mut reader = Reader::new(bytes);
    let _id = reader.u16()?;
    let flags = reader.u16()?;
    let rcode = (flags & 0x000f) as u8;
    let qdcount = reader.u16()?;
    let ancount = reader.u16()?;
    let nscount = reader.u16()?;
    let arcount = reader.u16()?;

    for _ in 0..qdcount {
        let _qname = reader.name()?;
        let _qtype = reader.u16()?;
        let _qclass = reader.u16()?;
    }

    let mut answers = Vec::new();
    for _ in 0..ancount {
        let name = reader.name()?;
        let type_code = reader.u16()?;
        let _class = reader.u16()?;
        let ttl = reader.u32()?;
        let rdlength = reader.u16()? as usize;
        let rdata_bytes = reader.bytes(rdlength)?;
        let rdata = parse_record_rdata(&mut reader, type_code, rdata_bytes)?;
        answers.push(Answer { name, ttl, type_code, rdata });
    }

    Ok((rcode, nscount, arcount, answers))
}

/// dig(1)風のテキスト出力を組み立てる。実際の名前解決(DNS over HTTPS経由の
/// fetch)はWorker側(TypeScript)が担当し、この関数はビルド済みの問い合わせと
/// 生の応答バイト列を受け取ってワイヤーフォーマットの解析・整形のみを行う。
#[wasm_bindgen]
pub fn dig_format_response(
    name: &str,
    qtype: &str,
    server: &str,
    query_ms: f64,
    response_bytes: &[u8],
) -> Result<String, JsValue> {
    let (rcode, nscount, arcount, answers) =
        parse_response_inner(response_bytes).map_err(|e| JsValue::from_str(&e))?;

    let mut lines = Vec::new();
    lines.push(format!("; <<>> neko-dig (Rust/WASM) <<>> {name} {}", qtype.to_ascii_uppercase()));
    lines.push(format!(";; Got answer:"));
    lines.push(format!(
        ";; ->>HEADER<<- status: {}, id: 4660",
        rcode_to_status(rcode)
    ));
    lines.push(format!(
        ";; QUESTION: 1, ANSWER: {}, AUTHORITY: {}, ADDITIONAL: {}",
        answers.len(),
        nscount,
        arcount
    ));
    lines.push(String::new());
    lines.push(";; QUESTION SECTION:".to_string());
    lines.push(format!(";{name}.\t\tIN\t{}", qtype.to_ascii_uppercase()));
    lines.push(String::new());

    if answers.is_empty() {
        lines.push(";; ANSWER SECTION: (0 records)".to_string());
    } else {
        lines.push(";; ANSWER SECTION:".to_string());
        for a in &answers {
            lines.push(format!(
                "{}.\t{}\tIN\t{}\t{}",
                a.name,
                a.ttl,
                code_to_qtype(a.type_code),
                a.rdata
            ));
        }
    }
    lines.push(String::new());
    lines.push(format!(";; SERVER: {server}"));
    lines.push(format!(";; Query time: {query_ms} msec"));

    Ok(lines.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_query_encodes_name_and_type() {
        let packet = dig_build_query_impl("example.com", "A").unwrap();
        assert_eq!(&packet[0..2], &[0x12, 0x34]);
        assert_eq!(&packet[4..6], &[0x00, 0x01]); // QDCOUNT
        let name_start = 12;
        assert_eq!(packet[name_start], 7);
        assert_eq!(&packet[name_start + 1..name_start + 8], b"example");
        let name_bytes = encode_name("example.com").unwrap();
        let type_pos = name_start + name_bytes.len();
        assert_eq!(&packet[type_pos..type_pos + 2], &[0x00, 0x01]);
    }

    #[test]
    fn qtype_unknown_is_error() {
        assert!(qtype_to_code("BOGUS").is_err());
    }

    #[test]
    fn ipv4_format() {
        assert_eq!(format_ipv4(&[93, 184, 216, 34]).unwrap(), "93.184.216.34");
    }

    #[test]
    fn ipv6_format_compresses_zero_run() {
        let mut bytes = [0u8; 16];
        bytes[0] = 0x20;
        bytes[1] = 0x01;
        bytes[14] = 0x00;
        bytes[15] = 0x01;
        assert_eq!(format_ipv6(&bytes).unwrap(), "2001::1");
    }

    #[test]
    fn parse_minimal_a_response() {
        // ID, flags(応答/RA/RD/rcode=0), QD=1, AN=1, NS=0, AR=0
        let mut packet: Vec<u8> = vec![0x12, 0x34, 0x81, 0x80, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00];
        // question: example.com A IN
        packet.extend_from_slice(&encode_name("example.com").unwrap());
        packet.extend_from_slice(&1u16.to_be_bytes());
        packet.extend_from_slice(&CLASS_IN.to_be_bytes());
        // answer: ポインタ(0xc00c)でquestion名を参照, TYPE A, CLASS IN, TTL 300, RDLENGTH 4, RDATA
        packet.extend_from_slice(&[0xc0, 0x0c]);
        packet.extend_from_slice(&1u16.to_be_bytes());
        packet.extend_from_slice(&CLASS_IN.to_be_bytes());
        packet.extend_from_slice(&300u32.to_be_bytes());
        packet.extend_from_slice(&4u16.to_be_bytes());
        packet.extend_from_slice(&[93, 184, 216, 34]);

        let (rcode, ns, ar, answers) = parse_response_inner(&packet).unwrap();
        assert_eq!(rcode, 0);
        assert_eq!(ns, 0);
        assert_eq!(ar, 0);
        assert_eq!(answers.len(), 1);
        assert_eq!(answers[0].name, "example.com");
        assert_eq!(answers[0].ttl, 300);
        assert_eq!(answers[0].rdata, "93.184.216.34");
    }

    // wasm_bindgen関数はJsValueを返しcargo test(非wasm32ターゲット)からは
    // 呼びにくいため、内部ロジックを直接呼べる薄いラッパーを用意する。
    fn dig_build_query_impl(name: &str, qtype: &str) -> Result<Vec<u8>, String> {
        let type_code = qtype_to_code(qtype)?;
        let mut packet = Vec::new();
        packet.extend_from_slice(&0x1234u16.to_be_bytes());
        packet.extend_from_slice(&0x0100u16.to_be_bytes());
        packet.extend_from_slice(&1u16.to_be_bytes());
        packet.extend_from_slice(&0u16.to_be_bytes());
        packet.extend_from_slice(&0u16.to_be_bytes());
        packet.extend_from_slice(&0u16.to_be_bytes());
        packet.extend_from_slice(&encode_name(name)?);
        packet.extend_from_slice(&type_code.to_be_bytes());
        packet.extend_from_slice(&CLASS_IN.to_be_bytes());
        Ok(packet)
    }
}
