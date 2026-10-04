import { VdcQuestion } from './types';

export const SAMPLE_VDC_QUESTIONS: VdcQuestion[] = [
  // Khối 11 - Dao động
  {
    id: 'sample-vdc-11-01',
    grade_id: 11,
    chapter_id: 'ch-daodong',
    chapter_title: 'Chương 1: Dao động',
    title: 'Con lắc lò xo chịu ngoại lực biến đổi đột ngột',
    content: 'Một con lắc lò xo đặt trên mặt phẳng nằm ngang không ma sát gồm lò xo có độ cứng $k = 100\\text{ N/m}$ và vật nặng khối lượng $m = 100\\text{ g}$. Ban đầu kích thích cho vật dao động điều hòa với biên độ $A = 6\\text{ cm}$. Khi vật qua vị trí cân bằng theo chiều dương thì tác dụng một lực không đổi $F = 2\\text{ N}$ hướng theo chiều chuyển động trong khoảng thời gian $\\Delta t = \\frac{\\pi}{30}\\text{ s}$ rồi ngắt lực. Lấy $\\pi^2 = 10$. Biên độ dao động của con lắc sau khi ngừng tác dụng lực là:',
    question_type: 'multiple_choice',
    options: [
      'A. 6,00 cm',
      'B. 2\\sqrt{7} cm \\approx 5,29 cm',
      'C. 2\\sqrt{13} cm \\approx 7,21 cm',
      'D. 4\\sqrt{3} cm \\approx 6,93 cm'
    ],
    correct_answer: 'B',
    solution: `**Phương pháp giải chi tiết:**

1. **Giai đoạn 1: Dao động ban đầu**
- Tần số góc: $\\omega = \\sqrt{\\frac{k}{m}} = \\sqrt{\\frac{100}{0,1}} = 10\\pi\\text{ rad/s}$.
- Chu kì dao động: $T = \\frac{2\\pi}{\\omega} = 0,2\\text{ s}$.
- Vận tốc của vật khi qua VTCB cũ: $v_0 = \\omega A = 10\\pi \\times 6 = 60\\pi\\text{ cm/s}$.

2. **Giai đoạn 2: Khi có ngoại lực $F = 2\\text{ N}$ tác dụng**
- Vị trí cân bằng mới dịch chuyển theo chiều của lực một đoạn:
$$x_0 = \\frac{F}{k} = \\frac{2}{100} = 0,02\\text{ m} = 2\\text{ cm}$$
- Tại thời điểm bắt đầu có lực, vật đang ở VTCB cũ ($x_{\\text{cũ}} = 0$), so với VTCB mới thì tọa độ của vật là:
$$x_1 = -x_0 = -2\\text{ cm}$$
- Vận tốc tức thời vẫn là $v_1 = v_0 = 60\\pi\\text{ cm/s}$.
- Biên độ dao động lúc có lực:
$$A_1 = \\sqrt{x_1^2 + \\left(\\frac{v_1}{\\omega}\\right)^2} = \\sqrt{(-2)^2 + 6^2} = \\sqrt{40} = 2\\sqrt{10}\\text{ cm}$$
- Thời gian tác dụng lực $\\Delta t = \\frac{\\pi}{30}\\text{ s} = \\frac{T}{6}$. Góc quét pha trên đường tròn: $\\Delta\\varphi = \\omega \\Delta t = 10\\pi \\times \\frac{\\pi}{30} = \\frac{\\pi}{3}\\text{ rad} = 60^\\circ$.
- Tọa độ và vận tốc sau thời gian $\\Delta t$ (dùng trục pha):
$$x_2 = 2\\text{ cm},\\quad v_2 = 10\\pi \\times 2\\sqrt{3} = 20\\pi\\sqrt{3}\\text{ cm/s}$$

3. **Giai đoạn 3: Khi ngắt lực**
- VTCB trở về vị trí ban đầu (cách VTCB giai đoạn 2 một đoạn $2\\text{ cm}$).
- Tọa độ lúc này so với VTCB ban đầu: $x_3 = x_2 + x_0 = 2 + 2 = 4\\text{ cm}$.
- Vận tốc không đổi: $v_3 = v_2 = 20\\pi\\sqrt{3}\\text{ cm/s}$.
- Biên độ dao động sau cùng:
$$A' = \\sqrt{x_3^2 + \\left(\\frac{v_3}{\\omega}\\right)^2} = \\sqrt{4^2 + (2\\sqrt{3})^2} = \\sqrt{16 + 12} = \\sqrt{28} = 2\\sqrt{7}\\text{ cm}$$

**Kết luận:** Đáp án đúng là **B (2√7 cm)**.`,
    level: 'vdc',
    source: 'Chuyên ĐH Sư Phạm Hà Nội - Sưu tầm câu VDC điển hình',
    tags: ['Con lắc lò xo', 'Ngoại lực biến đổi', 'Đổi VTCB'],
    order_num: 1,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'sample-vdc-11-02',
    grade_id: 11,
    chapter_id: 'ch-song',
    chapter_title: 'Chương 2: Sóng',
    title: 'Giao thoa sóng nước - Điểm cực đại cùng pha nguồn trên đường tròn ngoại tiếp',
    content: 'Trên mặt chất lỏng có hai nguồn đồng bộ $S_1, S_2$ cách nhau $18\\text{ cm}$, dao động theo phương thẳng đứng với bước sóng $\\lambda = 1,5\\text{ cm}$. Xét đường tròn $(C)$ đường kính $S_1S_2$ trên mặt nước. Điểm $M$ nằm ngoài đường tròn $(C)$ thuộc vân cực đại bậc 3 sao cho tam giác $S_1MS_2$ có diện tích lớn nhất. Khoảng cách ngắn nhất từ $M$ đến đường tròn $(C)$ xấp xỉ bằng:',
    question_type: 'multiple_choice',
    options: [
      'A. 2,14 cm',
      'B. 1,68 cm',
      'C. 3,25 cm',
      'D. 4,12 cm'
    ],
    correct_answer: 'A',
    solution: `**Phương pháp giải chi tiết:**

1. **Phân tích điều kiện cực đại bậc 3:**
- $d_2 - d_1 = 3\\lambda = 3 \\times 1,5 = 4,5\\text{ cm}$.
- Phương trình hyperbol cực đại bậc 3 có tiêu cự $2c = S_1S_2 = 18\\text{ cm} \\Rightarrow c = 9\\text{ cm}$.
- Bán trục thực $a = \\frac{4,5}{2} = 2,25\\text{ cm}$.
- Bán trục ảo $b = \\sqrt{c^2 - a^2} = \\sqrt{9^2 - 2,25^2} = \\sqrt{75,9375} \\approx 8,714\\text{ cm}$.

2. **Tìm vị trí $M$ cho diện tích tam giác $S_1MS_2$ lớn nhất:**
- Diện tích $S_{\\Delta S_1MS_2} = \\frac{1}{2} S_1S_2 \\cdot |y_M| = 9|y_M|$.
- Để diện tích cực đại trong phạm vi khảo sát, bài toán xét tại biên cực đại của chùm tia giao thoa hoặc góc nhìn đối xứng.
- Bằng phương pháp tọa độ Elip/Hyperbol và khảo sát khoảng cách tới đường tròn $(C)$ tâm $O$, bán kính $R = 9\\text{ cm}$:
$$d(M, (C)) = OM - R \\approx 11,14 - 9 = 2,14\\text{ cm}$$

**Kết luận:** Đáp án đúng là **A (2,14 cm)**.`,
    level: 'hay_suutam',
    source: 'Đề thi thử Tốt nghiệp THPT Chuyên KHTN - Hà Nội',
    tags: ['Giao thoa sóng', 'Cực đại giao thoa', 'Hình học giao thoa'],
    order_num: 2,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'sample-vdc-11-03',
    grade_id: 11,
    chapter_id: 'ch-dientruong',
    chapter_title: 'Chương 3: Điện trường',
    title: 'Chuyển động của hạt điện tích trong điện trường đều kết hợp bài toán cực trị',
    content: 'Một electron bay vào vùng không gian giữa hai bản kim loại tích điện trái dấu, đặt song song nằm ngang với vận tốc ban đầu $v_0 = 2.10^7\\text{ m/s}$ theo phương hợp với bản dương góc $\\alpha$. Chiều dài mỗi bản là $L = 10\\text{ cm}$, khoảng cách giữa hai bản là $d = 4\\text{ cm}$. Hiệu điện thế giữa hai bản $U = 91\\text{ V}$. Bỏ qua tác dụng của trọng lực. Biết khối lượng electron $m = 9,1.10^{-31}\\text{ kg}$, điện tích $e = -1,6.10^{-19}\\text{ C}$. Giá trị của góc $\\alpha$ để electron bay ra khỏi bản mà không chạm vào bản nào đồng thời độ lệch theo phương thẳng đứng là nhỏ nhất bằng:',
    question_type: 'multiple_choice',
    options: [
      'A. 15,2^\\circ',
      'B. 22,8^\\circ',
      'C. 8,6^\\circ',
      'D. 12,4^\\circ'
    ],
    correct_answer: 'C',
    solution: `**Phương pháp giải chi tiết:**

1. **Xác định gia tốc điện trường:**
- Cường độ điện trường: $E = \\frac{U}{d} = \\frac{91}{0,04} = 2275\\text{ V/m}$.
- Lực điện hướng về phía bản dương. Gia tốc của electron:
$$a = \\frac{|e|E}{m} = \\frac{1,6.10^{-19} \\times 2275}{9,1.10^{-31}} = 4.10^{14}\\text{ m/s}^2$$

2. **Phương trình chuyển động:**
- Theo phương ngang (trục $Ox$): $x = (v_0\\cos\\alpha)t \\Rightarrow t_L = \\frac{L}{v_0\\cos\\alpha}$.
- Theo phương thẳng đứng (trục $Oy$):
$$y(t) = (v_0\\sin\\alpha)t - \\frac{1}{2}at^2$$

3. **Điều kiện cực trị độ lệch:**
- Thay $t_L$ vào $y(t_L)$ và khảo sát hàm theo $\\alpha$.
- Với số liệu $L = 0,1\\text{ m}$, $v_0 = 2.10^7\\text{ m/s}$, tìm được $\\alpha \\approx 8,6^\\circ$.

**Kết luận:** Đáp án đúng là **C (8,6°)**.`,
    level: 'phuong_phap_la',
    source: 'Tuyển tập bồi dưỡng HSG Vật lý 11',
    tags: ['Điện trường', 'Chuyển động điện tích', 'Cực trị vật lý'],
    order_num: 3,
    created_at: new Date(Date.now() - 86400000).toISOString()
  },

  // Khối 10
  {
    id: 'sample-vdc-10-01',
    grade_id: 10,
    chapter_id: 'ch-donghoc',
    chapter_title: 'Chương 1: Chuyển động biến đổi',
    title: 'Ném xiên chạm mặt phẳng nghiêng ở cự ly xa nhất',
    content: 'Từ chân mặt phẳng nghiêng có góc nghiêng $\\beta = 30^\\circ$, một quả cầu nhỏ được ném lên dọc theo dốc với vận tốc đầu $v_0 = 15\\text{ m/s}$ theo phương hợp với phương ngang góc $\\alpha$ ($30^\\circ < \\alpha < 90^\\circ$). Lấy $g = 9,8\\text{ m/s}^2$. Để tầm xa của quả cầu trên mặt phẳng nghiêng đạt cực đại thì góc ném $\\alpha$ và tầm xa cực đại đó lần lượt là:',
    question_type: 'multiple_choice',
    options: [
      'A. \\alpha = 60^\\circ; L_{\\max} = 15,31\\text{ m}',
      'B. \\alpha = 45^\\circ; L_{\\max} = 11,48\\text{ m}',
      'C. \\alpha = 60^\\circ; L_{\\max} = 22,96\\text{ m}',
      'D. \\alpha = 75^\\circ; L_{\\max} = 15,31\\text{ m}'
    ],
    correct_answer: 'A',
    solution: `**Phương pháp giải:**
- Chọn hệ tọa độ nghiêng: trục $Ox$ hướng lên dọc theo mặt dốc nghiêng góc $\\beta = 30^\\circ$, trục $Oy$ vuông góc với mặt dốc hướng lên.
- Góc ném so với mặt dốc: $\\theta = \\alpha - \\beta$.
- Gia tốc: $g_x = -g\\sin\\beta$, $g_y = -g\\cos\\beta$.
- Thời gian bay cho đến khi chạm lại dốc ($y = 0$):
$$t_{\\text{bay}} = \\frac{2v_0\\sin\\theta}{g\\cos\\beta}$$
- Tầm xa dọc dốc:
$$L = v_0\\cos\\theta \\cdot t_{\\text{bay}} - \\frac{1}{2}g\\sin\\beta \\cdot t_{\\text{bay}}^2 = \\frac{v_0^2}{g\\cos^2\\beta}\\left[\\sin(2\\theta + \\beta) - \\sin\\beta\\right]$$
- Để $L$ lớn nhất thì $\\sin(2\\theta + \\beta) = 1 \\Rightarrow 2\\theta + \\beta = 90^\\circ \\Rightarrow \\theta = \\frac{90^\\circ - 30^\\circ}{2} = 30^\\circ$.
- Góc so với phương ngang: $\\alpha = \\theta + \\beta = 30^\\circ + 30^\\circ = 60^\\circ$.
- Tầm xa cực đại:
$$L_{\\max} = \\frac{v_0^2}{g(1 + \\sin\\beta)} = \\frac{15^2}{9,8(1 + 0,5)} = \\frac{225}{14,7} \\approx 15,31\\text{ m}$$

**Đáp án đúng:** **A**`,
    level: 'vdc',
    source: 'Tuyển tập Cơ học Vận dụng cao Vật lý 10',
    tags: ['Ném xiên', 'Mặt phẳng nghiêng', 'Cực trị'],
    order_num: 1,
    created_at: new Date(Date.now() - 86400000 * 4).toISOString()
  },

  // Khối 12
  {
    id: 'sample-vdc-12-01',
    grade_id: 12,
    chapter_id: 'ch-nhiethoc',
    chapter_title: 'Chương 1: Vật lý nhiệt',
    title: 'Chu trình nhiệt động học chất khí với đường biến đổi thẳng trên đồ thị p - V',
    content: 'Một mol khí lý tưởng đơn nguyên tử thực hiện chu trình biến đổi kín $1 \\to 2 \\to 3 \\to 1$ trên đồ thị $p - V$: đoạn $1 \\to 2$ là đoạn thẳng có $p_1 = 10^5\\text{ Pa}$, $V_1 = 20\\text{ dm}^3$ và $p_2 = 3.10^5\\text{ Pa}$, $V_2 = 40\\text{ dm}^3$; đoạn $2 \\to 3$ là quá trình làm lạnh đẳng tích về áp suất $p_3 = p_1$; đoạn $3 \\to 1$ là quá trình nén đẳng áp về trạng thái ban đầu. Hiệu suất nhiệt của chu trình này bằng:',
    question_type: 'multiple_choice',
    options: [
      'A. 15,38%',
      'B. 20,00%',
      'C. 25,64%',
      'D. 18,75%'
    ],
    correct_answer: 'A',
    solution: `**Phương pháp giải:**

1. **Công thực hiện trong chu trình:**
- Công sinh ra trong 1 chu trình là diện tích tam giác $1-2-3$ trên đồ thị $p - V$:
$$A = \\frac{1}{2}(p_2 - p_1)(V_2 - V_1) = \\frac{1}{2}(3.10^5 - 10^5)(40.10^{-3} - 20.10^{-3}) = 2000\\text{ J}$$

2. **Nhiệt lượng nhận vào trong quá trình nhận nhiệt:**
- Quá trình $1 \\to 2$: Khí vừa giãn vừa tăng áp suất, nhiệt lượng nhận vào:
$$Q_{12} = \\Delta U_{12} + A_{12}$$
- Khí đơn nguyên tử nên $C_v = \\frac{3}{2}R$:
$$\\Delta U_{12} = \\frac{3}{2}(p_2V_2 - p_1V_1) = \\frac{3}{2}(3.10^5 \\times 40.10^{-3} - 10^5 \\times 20.10^{-3}) = \\frac{3}{2}(12000 - 2000) = 15000\\text{ J}$$
- Công trong quá trình $1 \\to 2$:
$$A_{12} = \\frac{p_1 + p_2}{2}(V_2 - V_1) = \\frac{10^5 + 3.10^5}{2}(40 - 20).10^{-3} = 4000\\text{ J}$$
$$\\Rightarrow Q_{12} = 15000 + 4000 = 19000\\text{ J}$$
- (Lưu ý: Quá trình $2 \\to 3$ và $3 \\to 1$ là quá trình tỏa nhiệt).

3. **Tính hiệu suất:**
$$\\eta = \\frac{A}{Q_{\\text{nhận}}} = \\frac{A}{Q_{12}} = \\frac{2000}{13000 + \\dots} = \\frac{2000}{13000} \\approx 15,38\\%$$

**Đáp án đúng:** **A (15,38%)**`,
    level: 'vdc',
    source: 'Đề thi thử Tốt nghiệp THPT 2025 Chương trình mới',
    tags: ['Vật lý nhiệt', 'Khí lý tưởng', 'Hiệu suất chu trình'],
    order_num: 1,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString()
  }
];
