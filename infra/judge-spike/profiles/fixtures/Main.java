import java.util.Scanner;
public class Main {
    public static void main(String[] args) throws InterruptedException {
        Thread.sleep(100);
        Scanner input = new Scanner(System.in);
        long a = input.nextLong();
        long b = input.nextLong();
        System.out.println(a + b);
    }
}
