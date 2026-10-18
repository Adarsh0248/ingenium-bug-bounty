import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Scanner;
public class Main {
    public static void main(String[] args) throws Exception {
        Thread.sleep(100);
        int mode = new Scanner(System.in).nextInt();
        byte[] out = new byte[0], err = new byte[0];
        switch (mode) {
            case 0: break;
            case 1: out = "42\r\n".getBytes(StandardCharsets.UTF_8); err = "debug\n".getBytes(StandardCharsets.UTF_8); break;
            case 2: out = new byte[]{(byte)195, (byte)169, 0, (byte)240, (byte)159, (byte)154, (byte)128, 10}; break;
            case 3: out = new byte[]{(byte)255, (byte)254}; err = new byte[]{(byte)255}; break;
            case 4: case 5: case 6:
                out = new byte[mode == 4 ? 1048576 : mode == 5 ? 1048577 : 2097169];
                err = new byte[mode == 4 ? 65536 : mode == 5 ? 65537 : 131089];
                Arrays.fill(out, (byte)'x'); Arrays.fill(err, (byte)'d'); break;
            case 7: out = "41\n".getBytes(StandardCharsets.UTF_8); break;
            case 8: out = " 42 \t\r\n\u000b\f".getBytes(StandardCharsets.UTF_8); break;
            case 9: out = "1\u00a02\n".getBytes(StandardCharsets.UTF_8); break;
            default: throw new IllegalArgumentException();
        }
        System.out.write(out); System.out.flush();
        System.err.write(err); System.err.flush();
        if (System.out.checkError() || System.err.checkError()) System.exit(4);
    }
}
